<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Ernestdefoe\Parley\Notification\NewMessageBlueprint;
use Ernestdefoe\Parley\Notification\RoomMentionBlueprint;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\Notification;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Exception\FloodingException;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Everything that reads or changes a conversation.
 *
 * Plain query-builder rows rather than Eloquent models: the payloads are small,
 * hand-shaped arrays, and the builder applies the table prefix on every query,
 * which matters on customer forums that use one.
 */
class Conversations
{
    public const PAGE = 40;

    public const MAX_LENGTH = 4000;

    /** The reactions the hover tray offers, in its order. */
    public const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

    /** The colour labels a person can put on a conversation in their own list. */
    public const LABELS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

    /** The inbox's filters: All, Unread, Groups, and the More menu's. */
    public const FILTERS = ['all', 'unread', 'groups', 'mentions', 'pinned', 'starred', 'muted', 'archived', 'requests'];

    /** Message types a person's own message can be, as opposed to call and system rows. */
    public const CONTENT = ['text', 'image', 'voice', 'video', 'file'];

    /** How many people a group conversation's summary carries; the details column loads the rest. */
    private const GROUP_FACES = 4;

    /** The participant columns that are one person's own view of a conversation. */
    private const MINE = ['last_read_message_id', 'muted', 'archived_at', 'starred', 'label', 'role', 'requested_at', 'last_mention_id'];

    public function __construct(
        protected ConnectionInterface $db,
        protected Gate $gate,
        protected People $people,
        protected Broadcaster $broadcaster,
        protected PresenceStore $presence,
        protected NotificationSyncer $notifications,
        protected TranslatorInterface $translator,
        protected Cache $cache,
        protected Rooms $rooms
    ) {
    }

    // ── Finding conversations ───────────────────────────────────────────────

    /** The one-to-one conversation between two people, created on first use. */
    public function pair(User $actor, User $other): object
    {
        if ($reason = $this->gate->refusal($actor, $other)) {
            $this->refuse($reason, $other);
        }

        $key = min($actor->id, $other->id).':'.max($actor->id, $other->id);
        $conversation = $this->db->table('parley_conversations')->where('pair_key', $key)->first();
        $now = date('Y-m-d H:i:s');

        if (! $conversation) {
            $id = $this->db->table('parley_conversations')->insertGetId([
                'is_group' => false,
                'creator_id' => $actor->id,
                'pair_key' => $key,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // A first message from someone they do not follow waits in the
            // other person's Requests. Only a NEW conversation does: one that
            // already exists was accepted, or started by them.
            $request = $this->gate->landsInRequests($actor, $other) ? $now : null;

            foreach ([$actor->id, $other->id] as $userId) {
                $this->db->table('parley_participants')->insert([
                    'conversation_id' => $id,
                    'user_id' => $userId,
                    'joined_at' => $now,
                    'requested_at' => $userId === $other->id ? $request : null,
                ]);
            }

            $conversation = $this->db->table('parley_conversations')->where('id', $id)->first();
        }

        // Opening a closed conversation brings it back into your list.
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['hidden_at' => null]);

        return $conversation;
    }

    public function find(int $id, User $actor): object
    {
        $conversation = $this->db->table('parley_conversations')->find($id);

        if (! $conversation) {
            throw new ModelNotFoundException();
        }

        // A room is open to everyone who can see it; a direct conversation
        // only to the people in it.
        $allowed = $this->rooms->isRoom($conversation)
            ? $this->rooms->canChat($conversation, $actor)
            : $this->isParticipant($id, $actor->id);

        if (! $allowed) {
            throw new ModelNotFoundException();
        }

        return $conversation;
    }

    /** A conversation's row, with no access check: for code that has already made one. */
    public function row(int $id): ?object
    {
        return $this->db->table('parley_conversations')->find($id);
    }

    public function isParticipant(int $conversationId, int $userId): bool
    {
        return $this->db->table('parley_participants')
            ->where('conversation_id', $conversationId)->where('user_id', $userId)->exists();
    }

    /** @return int[] */
    public function participantIds(int $conversationId): array
    {
        return $this->db->table('parley_participants')->where('conversation_id', $conversationId)
            ->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    // ── Reading ─────────────────────────────────────────────────────────────

    /**
     * The viewer's conversations, newest activity first, in a fixed number of
     * queries.
     *
     * @return array{conversations: list<array<string, mixed>>, hasMore: bool}
     */
    public function listFor(User $viewer, string $filter = 'all', int $offset = 0, int $limit = 30): array
    {
        $q = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $viewer->id)
            ->where('c.type', 'direct')
            ->whereNotNull('c.last_message_id')
            ->where(fn ($q) => $q->whereNull('p.hidden_at')->orWhereColumn('c.last_message_at', '>', 'p.hidden_at'));

        // Requests wait in their own list, and the archive keeps its own;
        // every other filter is a slice of the inbox proper.
        if ($filter === 'requests') {
            $q->whereNotNull('p.requested_at');
        } else {
            $q->whereNull('p.requested_at');
            $filter === 'archived' ? $q->whereNotNull('p.archived_at') : $q->whereNull('p.archived_at');
        }

        match ($filter) {
            'unread' => $q->whereRaw($this->wrap('c.last_message_id').' > coalesce('.$this->wrap('p.last_read_message_id').', 0)'),
            'groups' => $q->where('c.is_group', true),
            'mentions' => $q->whereNotNull('p.last_mention_id'),
            'pinned' => $q->whereExists(fn ($w) => $w->from('parley_pins as pin')->whereColumn('pin.conversation_id', 'c.id')),
            'starred' => $q->where('p.starred', true),
            'muted' => $q->where('p.muted', true),
            default => null,
        };

        $rows = $q->orderByDesc('c.last_message_at')->orderByDesc('c.id')
            ->offset(max(0, $offset))->limit($limit + 1)
            ->get(array_merge(['c.*'], array_map(fn ($c) => 'p.'.$c, self::MINE)))->all();

        return [
            'conversations' => $this->summaries(array_slice($rows, 0, $limit), $viewer),
            'hasMore' => count($rows) > $limit,
        ];
    }

    /** @return array<string, mixed> */
    public function summary(object $conversation, User $viewer): array
    {
        $mine = $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $viewer->id)
            ->first(self::MINE);

        $row = (object) array_merge((array) $conversation, array_fill_keys(self::MINE, null), (array) ($mine ?? []));

        return $this->summaries([$row], $viewer)[0];
    }

    /**
     * Several conversations' summaries for one viewer, in the order given,
     * in the same fixed number of queries as one.
     *
     * @param  int[]  $ids
     * @return list<array<string, mixed>>
     */
    public function summariesFor(array $ids, User $viewer): array
    {
        if ($ids === []) {
            return [];
        }

        $rows = $this->db->table('parley_conversations as c')
            ->leftJoin('parley_participants as p', fn ($j) => $j->on('p.conversation_id', '=', 'c.id')->where('p.user_id', '=', $viewer->id))
            ->whereIn('c.id', $ids)
            ->get(array_merge(['c.*'], array_map(fn ($c) => 'p.'.$c, self::MINE)))
            ->keyBy('id');

        return $this->summaries(array_values(array_filter(array_map(fn ($id) => $rows->get($id), $ids))), $viewer);
    }

    /**
     * @param  list<object>  $rows  conversation rows carrying the viewer's last_read_message_id
     * @return list<array<string, mixed>>
     */
    private function summaries(array $rows, User $viewer): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rows);

        // A room's members can number in the hundreds and are not drawn in its
        // header, so only direct conversations load theirs.
        $directIds = array_map(fn ($r) => (int) $r->id, array_filter($rows, fn ($r) => ! $this->rooms->isRoom($r)));
        $participants = $directIds === [] ? collect() : $this->db->table('parley_participants')->whereIn('conversation_id', $directIds)
            ->orderBy('id')->get(['conversation_id', 'user_id', 'last_read_message_id', 'role']);
        $byConversation = $participants->groupBy('conversation_id');

        // A group's summary carries its first few faces, not all fifty: the
        // list draws a stack of them, and the details column loads the rest.
        $userIds = [];
        foreach ($byConversation as $members) {
            $others = $members->where('user_id', '!=', $viewer->id);
            foreach ($others->take(self::GROUP_FACES) as $p) {
                $userIds[(int) $p->user_id] = true;
            }
        }
        $userIds = array_keys($userIds);
        $users = $this->people->users($userIds);

        $lastIds = array_values(array_filter(array_map(fn ($r) => (int) $r->last_message_id, $rows)));
        $lastMessages = $this->payloads(
            $this->db->table('parley_messages')->whereIn('id', $lastIds)->get()->all()
        );
        $lastById = [];
        foreach ($lastMessages as $m) {
            $lastById[$m['id']] = $m;
        }

        $unread = $this->unreadCounts($viewer->id, $ids, true);
        $online = $this->presence->shownOnlineAmong($userIds);
        $pinned = $this->db->table('parley_pins')->whereIn('conversation_id', $ids)
            ->groupBy('conversation_id')->select('conversation_id as cid')->selectRaw('count(*) as n')
            ->pluck('n', 'cid');

        $out = [];
        foreach ($rows as $row) {
            $id = (int) $row->id;
            $isRoom = $this->rooms->isRoom($row);
            $isGroup = ! $isRoom && (bool) $row->is_group;
            $others = [];
            $seenBy = [];
            $memberCount = 0;
            $role = 'member';

            foreach ($byConversation->get($id, collect()) as $p) {
                $memberCount++;
                $uid = (int) $p->user_id;
                if ($uid === $viewer->id) {
                    $role = $p->role ?: 'member';
                    continue;
                }
                if ($user = $users->get($uid)) {
                    $others[] = $this->people->card($user) + ['online' => isset($online[$uid])];
                }
                $seenBy[$uid] = $p->last_read_message_id ? (int) $p->last_read_message_id : null;
            }

            $lastRead = $row->last_read_message_id ? (int) $row->last_read_message_id : null;

            $out[] = [
                'id' => $id,
                'type' => $isRoom ? 'room' : 'direct',
                'room' => $isRoom ? $this->rooms->card($row) : null,
                'isGroup' => $isGroup,
                'title' => $isRoom ? $row->title : ($row->title ?: null),
                'imageUrl' => $isGroup ? $this->photos()->url($row->image_path ?? null) : null,
                'participants' => $others,
                'memberCount' => $isRoom ? null : $memberCount,
                'role' => $role,
                'lastMessage' => $lastById[(int) $row->last_message_id] ?? null,
                'lastMessageAt' => $row->last_message_at ? Carbon::parse($row->last_message_at)->toIso8601String() : null,
                'lastReadMessageId' => $lastRead,
                // Read receipts by person; a group's carries every member's.
                'seenBy' => $seenBy,
                'unread' => $unread[$id] ?? 0,
                'muted' => (bool) $row->muted,
                'archived' => ! empty($row->archived_at),
                'starred' => (bool) ($row->starred ?? false),
                'label' => $row->label ?? null,
                'request' => ! empty($row->requested_at),
                'mentioned' => ! empty($row->last_mention_id) && (int) $row->last_mention_id > (int) $lastRead,
                'pinCount' => (int) ($pinned[$id] ?? 0),
            ];
        }

        return $out;
    }

    private function photos(): GroupPhotos
    {
        return resolve(GroupPhotos::class);
    }

    /** A column for raw SQL, prefixed and quoted the way the query builder would. */
    private function wrap(string $column): string
    {
        return $this->db->getQueryGrammar()->wrap($column);
    }

    /**
     * Unread messages per conversation for one person: messages from someone
     * else, newer than the last one they read.
     *
     * @param  int[]|null  $conversationIds  null for all of theirs
     * @return array<int, int>
     */
    public function unreadCounts(int $userId, ?array $conversationIds = null, bool $withRequests = false): array
    {
        $q = $this->db->table('parley_participants as p')
            ->join('parley_messages as m', 'm.conversation_id', '=', 'p.conversation_id')
            ->where('p.user_id', $userId)
            ->where(fn ($w) => $w->whereNull('m.user_id')->orWhere('m.user_id', '!=', $userId))
            ->whereNull('m.deleted_at')
            ->where(fn ($w) => $w->whereNull('p.last_read_message_id')->orWhereColumn('m.id', '>', 'p.last_read_message_id'))
            ->groupBy('p.conversation_id')
            ->select('p.conversation_id as cid')
            // 🚨 Not selectRaw for the column: raw SQL skips the table prefix,
            // and the alias `p` is prefixed like a table on a prefixed forum.
            ->selectRaw('count(*) as n');

        if ($conversationIds !== null) {
            $q->whereIn('p.conversation_id', $conversationIds);
        }

        // A message request is not news until it is accepted: it counts in
        // the Requests filter only, never on a badge.
        if (! $withRequests) {
            $q->whereNull('p.requested_at');
        }

        $out = [];
        foreach ($q->get() as $row) {
            $out[(int) $row->cid] = (int) $row->n;
        }

        return $out;
    }

    /**
     * Requests waiting for one person, and the conversations they have muted
     * or archived that have something unread — news that neither pops up
     * nor counts on the badge.
     *
     * @return array{requests: int, quiet: int[]}
     */
    public function inboxState(int $userId, array $unread): array
    {
        $requests = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $userId)->whereNotNull('p.requested_at')->whereNotNull('c.last_message_id')
            ->where(fn ($q) => $q->whereNull('p.hidden_at')->orWhereColumn('c.last_message_at', '>', 'p.hidden_at'))
            ->count();

        $quiet = array_keys(array_filter($unread));
        $quiet = $quiet === [] ? [] : $this->db->table('parley_participants')->where('user_id', $userId)
            ->whereIn('conversation_id', $quiet)->where(fn ($q) => $q->where('muted', true)->orWhereNotNull('archived_at'))
            ->pluck('conversation_id')->map(fn ($id) => (int) $id)->all();

        return ['requests' => $requests, 'quiet' => $quiet];
    }

    /** @return list<array<string, mixed>> oldest first */
    public function messages(int $conversationId, ?int $beforeId = null, ?int $afterId = null, ?int $aroundId = null): array
    {
        $q = $this->db->table('parley_messages')->where('conversation_id', $conversationId);

        // Opening a search result: the message, with some either side of it.
        if ($aroundId) {
            $before = (clone $q)->where('id', '<', $aroundId)->orderByDesc('id')->limit(self::PAGE / 2)->get()->reverse();
            $after = (clone $q)->where('id', '>=', $aroundId)->orderBy('id')->limit(self::PAGE / 2)->get();

            return $this->payloads($before->concat($after)->values()->all());
        }

        if ($afterId) {
            return $this->payloads($q->where('id', '>', $afterId)->orderBy('id')->limit(200)->get()->all());
        }

        if ($beforeId) {
            $q->where('id', '<', $beforeId);
        }

        $rows = $q->orderByDesc('id')->limit(self::PAGE)->get()->reverse()->values()->all();

        return $this->payloads($rows);
    }

    /**
     * @param  list<object>  $rows
     * @return list<array<string, mixed>>
     */
    public function payloads(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rows);

        $reactions = [];
        foreach ($this->db->table('parley_reactions')->whereIn('message_id', $ids)->orderBy('created_at')->get() as $r) {
            $reactions[(int) $r->message_id][] = ['userId' => (int) $r->user_id, 'emoji' => $r->emoji];
        }

        $pinned = array_fill_keys($this->db->table('parley_pins')->whereIn('message_id', $ids)
            ->pluck('message_id')->map(fn ($id) => (int) $id)->all(), true);

        $replyIds = array_values(array_filter(array_map(fn ($r) => (int) $r->reply_to_id, $rows)));
        $replies = $replyIds === [] ? collect() : $this->db->table('parley_messages')->whereIn('id', $replyIds)->get()->keyBy('id');

        // Each message carries its author: in a room the client has not met
        // most of the people talking, and one query here beats one per name.
        $authorIds = array_values(array_unique(array_filter(array_merge(
            array_map(fn ($r) => (int) $r->user_id, $rows),
            $replies->pluck('user_id')->map(fn ($id) => (int) $id)->all()
        ))));
        $authors = $this->people->users($authorIds);

        return array_map(function ($r) use ($reactions, $replies, $authors, $pinned) {
            $deleted = $r->deleted_at !== null;
            $reply = $r->reply_to_id ? $replies->get($r->reply_to_id) : null;

            return [
                'id' => (int) $r->id,
                'conversationId' => (int) $r->conversation_id,
                'userId' => $r->user_id ? (int) $r->user_id : null,
                'author' => $r->user_id && $authors->get((int) $r->user_id) ? $this->people->card($authors->get((int) $r->user_id)) : null,
                'type' => $r->type,
                'body' => $deleted ? null : $r->body,
                'meta' => $deleted || $r->meta === null ? null : json_decode($r->meta, true),
                'replyTo' => $reply ? [
                    'id' => (int) $reply->id,
                    'userId' => $reply->user_id ? (int) $reply->user_id : null,
                    'authorName' => $reply->user_id && $authors->get((int) $reply->user_id) ? $authors->get((int) $reply->user_id)->display_name : null,
                    'excerpt' => $reply->deleted_at ? null : (in_array($reply->type, ['text', 'file'], true) ? mb_substr((string) $reply->body, 0, 120) : null),
                    'type' => $reply->type,
                ] : null,
                'reactions' => $deleted ? [] : ($reactions[(int) $r->id] ?? []),
                'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
                'editedAt' => $r->edited_at ? Carbon::parse($r->edited_at)->toIso8601String() : null,
                'deleted' => $deleted,
                'pinned' => isset($pinned[(int) $r->id]),
            ];
        }, $rows);
    }

    public function message(int $id): ?object
    {
        return $this->db->table('parley_messages')->find($id);
    }

    // ── Writing ─────────────────────────────────────────────────────────────

    /**
     * Post a message. The single path every message takes, so pushes,
     * unread state and notifications cannot be skipped by one caller.
     * Parley Calls writes its call history through here with $type = 'call'.
     *
     * @param  array<string, mixed>|null  $meta
     * @return array<string, mixed> the message payload
     */
    public function send(object $conversation, User $actor, string $type, ?string $body, ?array $meta = null, ?int $replyToId = null, ?string $nonce = null): array
    {
        // A send retried after a dropped connection carries the same nonce:
        // the message it already made is the answer, not a second copy.
        $nonceKey = $nonce !== null && preg_match('/^[A-Za-z0-9_-]{8,40}$/', $nonce) ? 'parley.nonce.'.$actor->id.'.'.$nonce : null;
        if ($nonceKey && ($sent = $this->cache->get($nonceKey)) && ($row = $this->message((int) $sent))) {
            return $this->payloads([$row])[0] + ['nonce' => $nonce];
        }

        $this->guardSend($conversation, $actor);

        if ($type === 'text') {
            $body = trim((string) $body);
            if ($body === '') {
                throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.empty_message')]);
            }
            if (mb_strlen($body) > self::MAX_LENGTH) {
                throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.too_long', ['max' => self::MAX_LENGTH])]);
            }
        }

        if ($replyToId) {
            $replyTo = $this->message($replyToId);
            if (! $replyTo || (int) $replyTo->conversation_id !== (int) $conversation->id) {
                $replyToId = null;
            }
        }

        $now = date('Y-m-d H:i:s');

        // Posting in a room joins it.
        if ($this->rooms->isRoom($conversation)) {
            $this->rooms->join($conversation, $actor);
        }

        $id = $this->db->table('parley_messages')->insertGetId([
            'conversation_id' => $conversation->id,
            'user_id' => $actor->id,
            'type' => $type,
            'body' => $body,
            'meta' => $meta === null ? null : json_encode($meta),
            'reply_to_id' => $replyToId,
            'created_at' => $now,
        ]);

        $this->db->table('parley_conversations')->where('id', $conversation->id)
            ->update(['last_message_id' => $id, 'last_message_at' => $now, 'updated_at' => $now]);

        $this->db->table('parley_participants')->where('conversation_id', $conversation->id)
            ->update(['hidden_at' => null]);

        // News brings an archived conversation back to the inbox, unless it
        // was muted too: muting and archiving is "keep this out of my way".
        $this->db->table('parley_participants')->where('conversation_id', $conversation->id)
            ->whereNotNull('archived_at')->where('muted', false)
            ->update(['archived_at' => null]);

        // Writing back is accepting: a request you reply to is a conversation.
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['last_read_message_id' => $id, 'requested_at' => null]);

        $payload = $this->payloads([$this->message($id)])[0];
        if ($nonceKey) {
            $this->cache->put($nonceKey, $id, 600);
            $payload['nonce'] = $nonce;
        }

        if ($this->rooms->isRoom($conversation)) {
            $members = $this->rooms->audience($conversation, $this->participantIds((int) $conversation->id));
            $this->broadcaster->toUsers($members, 'message', ['message' => $payload]);
            if ($type === 'text') {
                $this->notifyMentions($conversation, $actor, (string) $body, $id);
            }

            return $payload;
        }

        $recipients = $this->participantIds((int) $conversation->id);
        $waiting = $this->requestedIds((int) $conversation->id);

        // The sender's own other tabs need it too. Someone holding this as a
        // request hears it quietly: it is filed, nothing pops up.
        $this->broadcaster->toUsers(array_diff($recipients, $waiting), 'message', ['message' => $payload]);
        $this->broadcaster->toUsers($waiting, 'message', ['message' => $payload, 'request' => true]);

        $mentioned = $type === 'text' && $conversation->is_group
            ? $this->notifyMentions($conversation, $actor, (string) $body, $id, $recipients, $waiting)
            : [];

        // A group's own news (renamed, left, a new photo) alerts nobody; being
        // put in a group alerts the people put in it.
        $alert = array_values(array_diff($recipients, [$actor->id], $waiting, $mentioned));
        if ($type === 'system') {
            $alert = match ($meta['action'] ?? null) {
                'created' => $alert,
                'added' => array_values(array_intersect($alert, array_map('intval', (array) ($meta['userIds'] ?? [])))),
                default => [],
            };
        }
        $this->notifyOffline($conversation, $actor, $alert);

        return $payload;
    }

    /**
     * Send the same message on to other conversations: up to five, each one
     * a conversation the sender may write in.
     *
     * @param  int[]  $conversationIds
     * @return list<array<string, mixed>>
     */
    public function forward(int $messageId, User $actor, array $conversationIds): array
    {
        $message = $this->message($messageId);

        if (! $message || $message->deleted_at || ! in_array($message->type, self::CONTENT, true)
            || ! $this->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        $ids = array_slice(array_values(array_unique(array_map('intval', $conversationIds))), 0, 5);
        if ($ids === []) {
            throw new ValidationException(['conversationIds' => $this->translator->trans('ernestdefoe-parley.api.forward_where')]);
        }

        // Every target is checked before anything is sent: all or nothing.
        $targets = array_map(fn (int $id) => $this->find($id, $actor), $ids);

        $meta = $message->meta === null ? [] : (array) json_decode($message->meta, true);
        unset($meta['forwarded']);
        $meta['forwarded'] = true;

        return array_map(
            fn (object $target) => $this->send($target, $actor, $message->type, $message->body, $meta),
            $targets
        );
    }

    /**
     * One person's own settings for a conversation: muted, archived, starred
     * and a colour label. Only what is sent changes.
     *
     * @param  array<string, mixed>  $changes
     */
    public function settings(object $conversation, User $actor, array $changes): void
    {
        $update = [];

        if (array_key_exists('muted', $changes)) {
            $update['muted'] = (bool) $changes['muted'];
        }
        if (array_key_exists('archived', $changes)) {
            $update['archived_at'] = $changes['archived'] ? date('Y-m-d H:i:s') : null;
        }
        if (array_key_exists('starred', $changes)) {
            $update['starred'] = (bool) $changes['starred'];
        }
        if (array_key_exists('label', $changes)) {
            $label = $changes['label'];
            if ($label !== null && ! in_array($label, self::LABELS, true)) {
                throw new ValidationException(['label' => $this->translator->trans('ernestdefoe-parley.api.unknown_label')]);
            }
            $update['label'] = $label;
        }

        if ($update === [] || ! $this->isParticipant((int) $conversation->id, $actor->id)) {
            return;
        }

        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update($update);

        // Your other tabs redraw the list.
        $this->broadcaster->toUsers([$actor->id], 'conversationChanged', ['conversationId' => (int) $conversation->id]);
    }

    /** Accept a message request: it moves to the inbox and behaves like any conversation. */
    public function accept(object $conversation, User $actor): void
    {
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['requested_at' => null]);

        $this->broadcaster->toUsers([$actor->id], 'conversationChanged', ['conversationId' => (int) $conversation->id]);
    }

    /** @return int[] who in a conversation is still holding it as a request */
    public function requestedIds(int $conversationId): array
    {
        return $this->db->table('parley_participants')->where('conversation_id', $conversationId)
            ->whereNotNull('requested_at')->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    public function edit(int $messageId, User $actor, string $body): array
    {
        $message = $this->ownMessage($messageId, $actor);
        $body = trim($body);

        if ($message->type !== 'text' || $body === '' || mb_strlen($body) > self::MAX_LENGTH) {
            throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.empty_message')]);
        }

        $this->db->table('parley_messages')->where('id', $messageId)
            ->update(['body' => $body, 'edited_at' => date('Y-m-d H:i:s')]);

        return $this->changed($messageId);
    }

    public function delete(int $messageId, User $actor): array
    {
        $message = $this->message($messageId);
        $conversation = $message ? $this->db->table('parley_conversations')->find($message->conversation_id) : null;

        // Rooms are public, so moderators keep them tidy. Direct conversations
        // stay private: there, only the author can remove a message.
        $moderating = $conversation && $this->rooms->isRoom($conversation)
            && $this->rooms->canChat($conversation, $actor)
            && $actor->hasPermission(Gate::MODERATE)
            && ! $message->deleted_at;

        if (! $moderating) {
            $this->ownMessage($messageId, $actor);
        }

        $this->db->table('parley_messages')->where('id', $messageId)
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        $this->db->table('parley_reactions')->where('message_id', $messageId)->delete();
        $this->db->table('parley_pins')->where('message_id', $messageId)->delete();

        return $this->changed($messageId);
    }

    /** Pick a reaction; picking the one you already have takes it away. */
    public function react(int $messageId, User $actor, string $emoji): array
    {
        if (! in_array($emoji, self::REACTIONS, true)) {
            throw new ValidationException(['emoji' => $this->translator->trans('ernestdefoe-parley.api.unknown_reaction')]);
        }

        $message = $this->message($messageId);
        if (! $message || $message->deleted_at || ! $this->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        $q = $this->db->table('parley_reactions')->where('message_id', $messageId)->where('user_id', $actor->id);
        $current = $q->value('emoji');

        if ($current === $emoji) {
            $q->delete();
        } elseif ($current !== null) {
            $q->update(['emoji' => $emoji, 'created_at' => date('Y-m-d H:i:s')]);
        } else {
            $this->db->table('parley_reactions')->insert([
                'message_id' => $messageId,
                'user_id' => $actor->id,
                'emoji' => $emoji,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->changed($messageId);
    }

    public function markRead(object $conversation, User $actor, int $messageId): void
    {
        $updated = $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->where(fn ($q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $messageId))
            ->where('conversation_id', $conversation->id)
            ->update(['last_read_message_id' => min($messageId, (int) $conversation->last_message_id)]);

        if ($updated) {
            // Nobody needs to know who has read a room; your own other tabs do.
            // Reading a request is not answering it, so its sender is not told.
            $private = $this->rooms->isRoom($conversation) || in_array($actor->id, $this->requestedIds((int) $conversation->id), true);
            $readers = $private ? [$actor->id] : $this->participantIds((int) $conversation->id);
            $this->broadcaster->toUsers($readers, 'read', [
                'conversationId' => (int) $conversation->id,
                'userId' => $actor->id,
                'messageId' => min($messageId, (int) $conversation->last_message_id),
            ]);

            // Reading the conversation is reading its alert.
            Notification::query()->where('user_id', $actor->id)
                ->where('type', NewMessageBlueprint::getType())
                ->where('data', json_encode(['conversationId' => (int) $conversation->id]))
                ->update(['read_at' => Carbon::now()]);
        }
    }

    public function typing(object $conversation, User $actor): void
    {
        // Throttled per person per conversation: the client sends at most one
        // every three seconds anyway, this stops a modified one sending more.
        $key = 'parley.typing.'.$conversation->id.'.'.$actor->id;
        if ($this->cache->has($key)) {
            return;
        }
        $this->cache->put($key, 1, 2);

        $others = array_values(array_diff($this->participantIds((int) $conversation->id), [$actor->id]));

        // In a room, only members on the site now can see the dots.
        if ($this->rooms->isRoom($conversation)) {
            $others = $this->rooms->audience($conversation, array_keys($this->presence->onlineAmong($others)));
        }

        $this->broadcaster->toUsers($others, 'typing', [
            'conversationId' => (int) $conversation->id,
            'userId' => $actor->id,
        ]);
    }

    public function hide(object $conversation, User $actor): void
    {
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['hidden_at' => date('Y-m-d H:i:s')]);
    }

    public function setMuted(object $conversation, User $actor, bool $muted): void
    {
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['muted' => $muted]);
    }

    // ── Internals ───────────────────────────────────────────────────────────

    /** Room: can see it. Direct: is in it. */
    public function canSee(int $conversationId, User $actor): bool
    {
        $conversation = $this->db->table('parley_conversations')->find($conversationId);

        if (! $conversation) {
            return false;
        }

        return $this->rooms->isRoom($conversation)
            ? $this->rooms->canChat($conversation, $actor)
            : $this->isParticipant($conversationId, $actor->id);
    }

    /**
     * @username alerts that person — once per message, never the sender. In a
     * room, anyone who can see the room; in a group, its members, except one
     * still holding it as an unanswered request.
     *
     * @param  int[]|null  $members  a group's members; null for a room
     * @param  int[]  $waiting  members holding it as a request
     * @return int[] who was alerted
     */
    private function notifyMentions(object $conversation, User $actor, string $body, int $messageId, ?array $members = null, array $waiting = []): array
    {
        if (! preg_match_all('/(?<![\w@])@([A-Za-z0-9_\-.]{2,30})/u', $body, $m)) {
            return [];
        }

        $names = array_slice(array_unique(array_map('mb_strtolower', $m[1])), 0, 10);
        $q = User::query()->whereIn('username', $names)->where('id', '!=', $actor->id);
        if ($members !== null) {
            $q->whereIn('id', array_diff($members, $waiting));
        }
        $users = $q->get()
            ->filter(fn (User $u) => ($members !== null || $this->rooms->canView($conversation, $u)) && ! $this->relationsBlock($actor, $u))
            ->values()->all();

        if ($users === []) {
            return [];
        }

        $ids = array_map(fn (User $u) => (int) $u->id, $users);
        $this->db->table('parley_participants')->where('conversation_id', $conversation->id)
            ->whereIn('user_id', $ids)->update(['last_mention_id' => $messageId]);

        $this->notifications->sync(new RoomMentionBlueprint($actor, (int) $conversation->id, $messageId), $users);

        return $ids;
    }

    private function relationsBlock(User $a, User $b): bool
    {
        return $this->db->table('parley_blocks')
            ->where(fn ($q) => $q->where('user_id', $a->id)->where('blocked_id', $b->id))
            ->orWhere(fn ($q) => $q->where('user_id', $b->id)->where('blocked_id', $a->id))
            ->exists();
    }

    private function guardSend(object $conversation, User $actor): void
    {
        if (! $this->gate->canUse($actor)) {
            throw new PermissionDeniedException();
        }

        if ($this->rooms->isRoom($conversation)) {
            // An owned room is voice only: there is no chat to post to.
            if ($this->rooms->isOwned($conversation)) {
                throw new ModelNotFoundException();
            }
            if ($reason = $this->rooms->postRefusal($conversation, $actor)) {
                $this->refuse($reason, null);
            }
        } elseif ($conversation->is_group) {
            // A group is written in by its members, and only them.
            if (! $this->isParticipant((int) $conversation->id, $actor->id)) {
                throw new ModelNotFoundException();
            }
        } else {
            // A one-to-one conversation is re-checked on every send: a block or a
            // "nobody" setting applies to conversations that already exist.
            $otherId = collect($this->participantIds((int) $conversation->id))->first(fn ($id) => $id !== $actor->id);
            $other = $otherId ? User::find($otherId) : null;

            if (! $other) {
                $this->refuse('unavailable', null);
            }

            if ($reason = $this->gate->refusal($actor, $other)) {
                $this->refuse($reason, $other);
            }
        }

        // Twenty messages in ten seconds is a script, not a person.
        $key = 'parley.flood.'.$actor->id;
        $count = (int) $this->cache->get($key, 0);
        if ($count >= 20) {
            throw new FloodingException();
        }
        $this->cache->put($key, $count + 1, 10);
    }

    private function ownMessage(int $messageId, User $actor): object
    {
        $message = $this->message($messageId);

        if (! $message || ! $this->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        if ((int) $message->user_id !== $actor->id || $message->deleted_at) {
            throw new PermissionDeniedException();
        }

        return $message;
    }

    private function changed(int $messageId): array
    {
        $payload = $this->payloads([$this->message($messageId)])[0];
        $conversation = $this->db->table('parley_conversations')->find($payload['conversationId']);
        $members = $this->participantIds($payload['conversationId']);

        if ($conversation && $this->rooms->isRoom($conversation)) {
            $members = $this->rooms->audience($conversation, $members);
        }

        $this->broadcaster->toUsers($members, 'messageChanged', ['message' => $payload]);

        return $payload;
    }

    /**
     * A Flarum alert for people who are not on the site to see the chat head
     * light up. Someone online already sees the message; alerting them too is
     * the same news twice.
     *
     * @param  int[]  $recipientIds
     */
    private function notifyOffline(object $conversation, User $actor, array $recipientIds): void
    {
        if ($recipientIds === []) {
            return;
        }

        $online = $this->presence->onlineAmong($recipientIds);
        $muted = $this->db->table('parley_participants')->where('conversation_id', $conversation->id)
            ->where('muted', true)->pluck('user_id')->map(fn ($id) => (int) $id)->all();

        $targets = array_values(array_diff($recipientIds, array_keys($online), $muted));
        if ($targets === []) {
            return;
        }

        $blueprint = new NewMessageBlueprint($actor, (int) $conversation->id);

        // One alert per conversation. If they already read the last one, it is
        // removed so this message raises a fresh, unread alert instead of
        // quietly restoring a read one.
        Notification::query()->matchingBlueprint($blueprint)
            ->whereIn('user_id', $targets)->whereNotNull('read_at')->delete();

        $this->notifications->sync($blueprint, $this->people->users($targets)->values()->all());
    }

    /** @return never */
    private function refuse(string $reason, ?User $other): void
    {
        throw new ValidationException(['user' => $this->translator->trans('ernestdefoe-parley.api.refusal.'.$reason, [
            'name' => $other->display_name ?? '',
        ])]);
    }
}
