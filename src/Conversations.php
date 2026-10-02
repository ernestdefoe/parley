<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Ernestdefoe\Parley\Notification\NewMessageBlueprint;
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

    public function __construct(
        protected ConnectionInterface $db,
        protected Gate $gate,
        protected People $people,
        protected Broadcaster $broadcaster,
        protected PresenceStore $presence,
        protected NotificationSyncer $notifications,
        protected TranslatorInterface $translator,
        protected Cache $cache
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

            foreach ([$actor->id, $other->id] as $userId) {
                $this->db->table('parley_participants')->insert([
                    'conversation_id' => $id,
                    'user_id' => $userId,
                    'joined_at' => $now,
                ]);
            }

            $conversation = $this->db->table('parley_conversations')->find($id);
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

        if (! $conversation || ! $this->isParticipant($id, $actor->id)) {
            throw new ModelNotFoundException();
        }

        return $conversation;
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
     * @return list<array<string, mixed>>
     */
    public function listFor(User $viewer, int $limit = 30): array
    {
        $rows = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $viewer->id)
            ->whereNotNull('c.last_message_id')
            ->where(fn ($q) => $q->whereNull('p.hidden_at')->orWhereColumn('c.last_message_at', '>', 'p.hidden_at'))
            ->orderByDesc('c.last_message_at')
            ->limit($limit)
            ->get(['c.*', 'p.last_read_message_id', 'p.muted']);

        return $this->summaries($rows->all(), $viewer);
    }

    /** @return array<string, mixed> */
    public function summary(object $conversation, User $viewer): array
    {
        $mine = $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $viewer->id)
            ->first(['last_read_message_id', 'muted']);

        $row = (object) array_merge((array) $conversation, [
            'last_read_message_id' => $mine->last_read_message_id ?? null,
            'muted' => $mine->muted ?? false,
        ]);

        return $this->summaries([$row], $viewer)[0];
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

        $participants = $this->db->table('parley_participants')->whereIn('conversation_id', $ids)
            ->get(['conversation_id', 'user_id', 'last_read_message_id']);

        $userIds = $participants->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->all();
        $users = User::query()->whereIn('id', $userIds)->with('groups')->get()->keyBy('id');

        $lastIds = array_values(array_filter(array_map(fn ($r) => (int) $r->last_message_id, $rows)));
        $lastMessages = $this->payloads(
            $this->db->table('parley_messages')->whereIn('id', $lastIds)->get()->all()
        );
        $lastById = [];
        foreach ($lastMessages as $m) {
            $lastById[$m['id']] = $m;
        }

        $unread = $this->unreadCounts($viewer->id, $ids);
        $online = $this->presence->onlineAmong($userIds);

        $out = [];
        foreach ($rows as $row) {
            $id = (int) $row->id;
            $others = [];
            $seenBy = [];

            foreach ($participants->where('conversation_id', $id) as $p) {
                $uid = (int) $p->user_id;
                if ($uid === $viewer->id) {
                    continue;
                }
                if ($user = $users->get($uid)) {
                    $others[] = $this->people->card($user) + ['online' => isset($online[$uid])];
                }
                $seenBy[$uid] = $p->last_read_message_id ? (int) $p->last_read_message_id : null;
            }

            $out[] = [
                'id' => $id,
                'isGroup' => (bool) $row->is_group,
                'title' => $row->title,
                'participants' => $others,
                'lastMessage' => $lastById[(int) $row->last_message_id] ?? null,
                'lastMessageAt' => $row->last_message_at ? Carbon::parse($row->last_message_at)->toIso8601String() : null,
                'lastReadMessageId' => $row->last_read_message_id ? (int) $row->last_read_message_id : null,
                'seenBy' => $seenBy,
                'unread' => $unread[$id] ?? 0,
                'muted' => (bool) $row->muted,
            ];
        }

        return $out;
    }

    /**
     * Unread messages per conversation for one person: messages from someone
     * else, newer than the last one they read.
     *
     * @param  int[]|null  $conversationIds  null for all of theirs
     * @return array<int, int>
     */
    public function unreadCounts(int $userId, ?array $conversationIds = null): array
    {
        $q = $this->db->table('parley_participants as p')
            ->join('parley_messages as m', 'm.conversation_id', '=', 'p.conversation_id')
            ->where('p.user_id', $userId)
            ->where(fn ($w) => $w->whereNull('m.user_id')->orWhere('m.user_id', '!=', $userId))
            ->whereNull('m.deleted_at')
            ->where(fn ($w) => $w->whereNull('p.last_read_message_id')->orWhereColumn('m.id', '>', 'p.last_read_message_id'))
            ->groupBy('p.conversation_id')
            ->selectRaw('p.conversation_id as cid, count(*) as n');

        if ($conversationIds !== null) {
            $q->whereIn('p.conversation_id', $conversationIds);
        }

        $out = [];
        foreach ($q->get() as $row) {
            $out[(int) $row->cid] = (int) $row->n;
        }

        return $out;
    }

    /** @return list<array<string, mixed>> oldest first */
    public function messages(int $conversationId, ?int $beforeId = null, ?int $afterId = null): array
    {
        $q = $this->db->table('parley_messages')->where('conversation_id', $conversationId);

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

        $replyIds = array_values(array_filter(array_map(fn ($r) => (int) $r->reply_to_id, $rows)));
        $replies = $replyIds === [] ? collect() : $this->db->table('parley_messages')->whereIn('id', $replyIds)->get()->keyBy('id');

        return array_map(function ($r) use ($reactions, $replies) {
            $deleted = $r->deleted_at !== null;
            $reply = $r->reply_to_id ? $replies->get($r->reply_to_id) : null;

            return [
                'id' => (int) $r->id,
                'conversationId' => (int) $r->conversation_id,
                'userId' => $r->user_id ? (int) $r->user_id : null,
                'type' => $r->type,
                'body' => $deleted ? null : $r->body,
                'meta' => $deleted || $r->meta === null ? null : json_decode($r->meta, true),
                'replyTo' => $reply ? [
                    'id' => (int) $reply->id,
                    'userId' => $reply->user_id ? (int) $reply->user_id : null,
                    'excerpt' => $reply->deleted_at ? null : ($reply->type === 'image' ? null : mb_substr((string) $reply->body, 0, 120)),
                    'type' => $reply->type,
                ] : null,
                'reactions' => $deleted ? [] : ($reactions[(int) $r->id] ?? []),
                'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
                'editedAt' => $r->edited_at ? Carbon::parse($r->edited_at)->toIso8601String() : null,
                'deleted' => $deleted,
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
    public function send(object $conversation, User $actor, string $type, ?string $body, ?array $meta = null, ?int $replyToId = null): array
    {
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

        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['last_read_message_id' => $id]);

        $payload = $this->payloads([$this->message($id)])[0];
        $recipients = $this->participantIds((int) $conversation->id);

        // The sender's own other tabs need it too.
        $this->broadcaster->toUsers($recipients, 'message', ['message' => $payload]);

        $this->notifyOffline($conversation, $actor, array_values(array_diff($recipients, [$actor->id])));

        return $payload;
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
        $this->ownMessage($messageId, $actor);

        $this->db->table('parley_messages')->where('id', $messageId)
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        $this->db->table('parley_reactions')->where('message_id', $messageId)->delete();

        return $this->changed($messageId);
    }

    /** Pick a reaction; picking the one you already have takes it away. */
    public function react(int $messageId, User $actor, string $emoji): array
    {
        if (! in_array($emoji, self::REACTIONS, true)) {
            throw new ValidationException(['emoji' => 'Unknown reaction.']);
        }

        $message = $this->message($messageId);
        if (! $message || $message->deleted_at || ! $this->isParticipant((int) $message->conversation_id, $actor->id)) {
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
            $this->broadcaster->toUsers($this->participantIds((int) $conversation->id), 'read', [
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

    private function guardSend(object $conversation, User $actor): void
    {
        if (! $this->gate->canUse($actor)) {
            throw new PermissionDeniedException();
        }

        // A one-to-one conversation is re-checked on every send: a block or a
        // "nobody" setting applies to conversations that already exist.
        if (! $conversation->is_group) {
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

        if (! $message || ! $this->isParticipant((int) $message->conversation_id, $actor->id)) {
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

        $this->broadcaster->toUsers($this->participantIds($payload['conversationId']), 'messageChanged', ['message' => $payload]);

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

        $this->notifications->sync($blueprint, User::query()->whereIn('id', $targets)->get()->all());
    }

    /** @return never */
    private function refuse(string $reason, ?User $other): void
    {
        throw new ValidationException(['user' => $this->translator->trans('ernestdefoe-parley.api.refusal.'.$reason, [
            'name' => $other?->display_name ?? '',
        ])]);
    }
}
