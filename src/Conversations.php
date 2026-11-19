<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Everything that changes a conversation, and its messages. The inbox's
 * summaries are Inbox; alerts are Alerts.
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

    public function __construct(
        protected ConnectionInterface $db,
        protected Gate $gate,
        protected Broadcaster $broadcaster,
        protected PresenceStore $presence,
        protected TranslatorInterface $translator,
        protected Cache $cache,
        protected Rooms $rooms,
        protected RateLimit $rateLimit,
        protected MessagePayloads $payloads,
        protected Inbox $inbox,
        protected Alerts $alerts
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

        if (! $conversation) {
            // Thirty new conversations an hour is plenty for a person; a script opens more.
            $this->rateLimit->hit('pairs', $actor->id, 30, 3600);

            try {
                $conversation = $this->db->transaction(fn () => $this->openPair($actor, $other, $key));
            } catch (UniqueConstraintViolationException) {
                // Opened at the same moment by a second tab or the other
                // person: theirs is the conversation.
                $conversation = $this->db->table('parley_conversations')->where('pair_key', $key)->first();
            }
        }

        // Opening a closed conversation brings it back into your list.
        $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->update(['hidden_at' => null]);

        return $conversation;
    }

    /** A new one-to-one conversation and both its people, together. */
    private function openPair(User $actor, User $other, string $key): object
    {
        $now = date('Y-m-d H:i:s');
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

        $this->db->table('parley_participants')->insert(array_map(fn (int $userId) => [
            'conversation_id' => $id,
            'user_id' => $userId,
            'joined_at' => $now,
            'requested_at' => $userId === $other->id ? $request : null,
        ], [$actor->id, $other->id]));

        return $this->db->table('parley_conversations')->where('id', $id)->first();
    }

    public function find(int $id, User $actor): object
    {
        $conversation = $this->db->table('parley_conversations')->find($id);

        if (! $conversation || ! $this->allows($conversation, $actor)) {
            throw new ModelNotFoundException();
        }

        return $conversation;
    }

    /** Room: can see it. Direct: is in it. */
    public function canSee(int $conversationId, User $actor): bool
    {
        $conversation = $this->db->table('parley_conversations')->find($conversationId);

        return $conversation !== null && $this->allows($conversation, $actor);
    }

    /** A room is open to everyone who can see it; a direct conversation only to the people in it. */
    private function allows(object $conversation, User $actor): bool
    {
        return $this->rooms->isRoom($conversation)
            ? $this->rooms->canChat($conversation, $actor)
            : $this->isParticipant((int) $conversation->id, $actor->id);
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
     * Messages as the client draws them. Kept here for callers that already
     * hold Conversations; the work is MessagePayloads'.
     *
     * @param  list<object>  $rows
     * @return list<array<string, mixed>>
     */
    public function payloads(array $rows): array
    {
        return $this->payloads->payloads($rows);
    }

    /**
     * Several conversations' summaries for one viewer: Inbox's, kept here for
     * callers that already hold Conversations.
     *
     * @param  int[]  $ids
     * @return list<array<string, mixed>>
     */
    public function summariesFor(array $ids, User $viewer): array
    {
        return $this->inbox->summariesFor($ids, $viewer);
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
        $body = $type === 'text' ? $this->validBody($body) : $body;

        if ($replyToId) {
            $replyTo = $this->message($replyToId);
            if (! $replyTo || (int) $replyTo->conversation_id !== (int) $conversation->id) {
                $replyToId = null;
            }
        }

        // Posting in a room joins it.
        if ($this->rooms->isRoom($conversation)) {
            $this->rooms->join($conversation, $actor);
        }

        $id = $this->db->transaction(fn () => $this->store($conversation, $actor, $type, $body, $meta, $replyToId));

        $payload = $this->payloads([$this->message($id)])[0];
        if ($nonceKey) {
            $this->cache->put($nonceKey, $id, 600);
            $payload['nonce'] = $nonce;
        }

        $this->deliver($conversation, $actor, $type, (string) $body, $meta, $id, $payload);

        return $payload;
    }

    private function validBody(?string $body): string
    {
        $body = trim((string) $body);
        if ($body === '') {
            throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.empty_message')]);
        }
        if (mb_strlen($body) > self::MAX_LENGTH) {
            throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.too_long', ['max' => self::MAX_LENGTH])]);
        }

        return $body;
    }

    /**
     * The message and the conversation's state it changes, together: a
     * conversation never points at a message that is not there.
     *
     * @param  array<string, mixed>|null  $meta
     */
    private function store(object $conversation, User $actor, string $type, ?string $body, ?array $meta, ?int $replyToId): int
    {
        $now = date('Y-m-d H:i:s');

        $id = (int) $this->db->table('parley_messages')->insertGetId([
            'conversation_id' => $conversation->id,
            'user_id' => $actor->id,
            'type' => $type,
            'body' => $body,
            'meta' => $meta === null ? null : json_encode($meta),
            // The details column's Links tab and search's link filter read
            // this instead of scanning every message's text.
            'has_link' => MessageLinks::has($body),
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

        return $id;
    }

    /**
     * Push a stored message to whoever should see it, and alert who should hear of it.
     *
     * @param  array<string, mixed>|null  $meta
     * @param  array<string, mixed>  $payload
     */
    private function deliver(object $conversation, User $actor, string $type, string $body, ?array $meta, int $id, array $payload): void
    {
        if ($this->rooms->isRoom($conversation)) {
            $members = $this->rooms->audience($conversation, $this->participantIds((int) $conversation->id));
            $this->broadcaster->toUsers($members, 'message', ['message' => $payload]);
            if ($type === 'text') {
                $this->alerts->mentions($conversation, $actor, $body, $id);
            }

            return;
        }

        $recipients = $this->participantIds((int) $conversation->id);
        $waiting = $this->requestedIds((int) $conversation->id);

        // The sender's own other tabs need it too. Someone holding this as a
        // request hears it quietly: it is filed, nothing pops up.
        $this->broadcaster->toUsers(array_diff($recipients, $waiting), 'message', ['message' => $payload]);
        $this->broadcaster->toUsers($waiting, 'message', ['message' => $payload, 'request' => true]);

        $mentioned = $type === 'text' && $conversation->is_group
            ? $this->alerts->mentions($conversation, $actor, $body, $id, $recipients, $waiting)
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
        $this->alerts->offline($conversation, $actor, $alert);
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

    public function markRead(object $conversation, User $actor, int $messageId): void
    {
        $updated = $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $actor->id)
            ->where(fn ($q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $messageId))
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
            $this->alerts->read((int) $conversation->id, $actor);
        }
    }

    public function typing(object $conversation, User $actor): void
    {
        // Throttled per person per conversation: the client sends at most one
        // every three seconds anyway, this stops a modified one sending more.
        // add() is atomic: of two at once, only one goes through.
        if (! $this->cache->add('parley.typing.'.$conversation->id.'.'.$actor->id, 1, 2)) {
            return;
        }

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
        $this->rateLimit->hit('flood', $actor->id, 20, 10);
    }

    /** @return never */
    private function refuse(string $reason, ?User $other): void
    {
        throw new ValidationException(['user' => $this->translator->trans('ernestdefoe-parley.api.refusal.'.$reason, [
            'name' => $other->display_name ?? '',
        ])]);
    }
}
