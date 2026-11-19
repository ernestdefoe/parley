<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Ernestdefoe\Parley\Notification\NewMessageBlueprint;
use Ernestdefoe\Parley\Notification\RoomMentionBlueprint;
use Flarum\Notification\Notification;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Flarum alerts about messages: @mentions, news for someone who is not on the
 * site, and marking a conversation's alert read once it has been read.
 */
class Alerts
{
    public function __construct(
        protected ConnectionInterface $db,
        protected People $people,
        protected PresenceStore $presence,
        protected Rooms $rooms,
        protected Relations $relations,
        protected NotificationSyncer $notifications
    ) {
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
    public function mentions(object $conversation, User $actor, string $body, int $messageId, ?array $members = null, array $waiting = []): array
    {
        if (! preg_match_all('/(?<![\w@])@([A-Za-z0-9_\-.]{2,30})/u', $body, $m)) {
            return [];
        }

        $names = array_slice(array_values(array_unique(array_map('strtolower', $m[1]))), 0, 10);

        // Usernames compare case-insensitively everywhere: MySQL's collation
        // already does, PostgreSQL needs ILIKE, and SQLite's LIKE folds ASCII
        // (all a username may hold here). LIKE's `_` matches any character,
        // so the exact name is checked again below.
        $like = $this->db->getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $q = User::query()->whereVisibleTo($actor)
            ->where(function ($w) use ($names, $like) {
                foreach ($names as $name) {
                    $w->orWhere('users.username', $like, $name);
                }
            })
            ->where('users.id', '!=', $actor->id);
        if ($members !== null) {
            $q->whereIn('users.id', array_diff($members, $waiting));
        }

        $blocked = $this->relations->blockedEitherWay($actor->id);
        $users = $q->get()
            ->filter(fn (User $u) => in_array(strtolower($u->username), $names, true)
                && ! isset($blocked[(int) $u->id])
                // At most ten names: a room's per-person visibility check is
                // bounded by that, not by the size of the room.
                && ($members !== null || $this->rooms->canView($conversation, $u)))
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

    /**
     * A Flarum alert for people who are not on the site to see the chat head
     * light up. Someone online already sees the message; alerting them too is
     * the same news twice.
     *
     * @param  int[]  $recipientIds
     */
    public function offline(object $conversation, User $actor, array $recipientIds): void
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

    /**
     * Reading a conversation is reading its alerts, whoever sent them.
     *
     * The sender is part of core's matchingBlueprint(), and a group's alerts
     * come from several, so the conversation is matched on `data` alone — the
     * way core compares it: `data` is native JSON on PostgreSQL (no `=` for
     * json, so it is cast to text) and on MySQL (stored canonicalised, so the
     * value is cast to JSON too); MariaDB and SQLite keep the bytes as text.
     */
    public function read(int $conversationId, User $actor): void
    {
        $data = json_encode((new NewMessageBlueprint($actor, $conversationId))->getData());

        Notification::query()->where('user_id', $actor->id)
            ->where('type', NewMessageBlueprint::getType())
            ->whereNull('read_at')
            ->whenPgSql(
                fn ($q) => $q->whereRaw('data::text = ?', [$data]),
                fn ($q) => $q->whenMySql(
                    fn ($q) => $q->whereRaw('data = CAST(? AS JSON)', [$data]),
                    fn ($q) => $q->where('data', $data)
                )
            )
            ->update(['read_at' => Carbon::now()]);
    }
}
