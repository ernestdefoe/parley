<?php

namespace Ernestdefoe\Parley;

use Flarum\Discussion\Discussion;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Who is on the forum right now, and where.
 *
 * A heartbeat rewrites one row per visitor; a visitor is online while their row
 * is younger than WINDOW. The same design as ernestdefoe/presence, carried here
 * rather than depended on, because Parley is public and presence is not.
 *
 * Nothing in here asks flarum/realtime. Its presence channels keep membership
 * in the daemon's memory, where PHP cannot read it.
 */
class PresenceStore
{
    /** Three heartbeats, so one dropped request does not blink someone out. */
    public const WINDOW = 90;

    public const HEARTBEAT = 30;

    public const STATUSES = ['online', 'away', 'busy', 'invisible'];

    public const PLACES = ['index', 'discussion', 'reply', 'tag', 'user', 'messages', 'other'];

    public function __construct(
        protected ConnectionInterface $db
    ) {
    }

    /**
     * @param  array{status?: string, place?: string, discussionId?: int|null, near?: int|null, tagId?: int|null}  $where
     */
    /**
     * @return string what changed for everyone else's list: 'list' when
     *                somebody arrived or changed status, 'moved' when a member
     *                went somewhere new (the activity line), '' for nothing.
     *                The caller decides how often each is worth announcing.
     */
    public function beat(string $visitorKey, ?User $actor, array $where): string
    {
        $status = in_array($where['status'] ?? '', self::STATUSES, true) ? $where['status'] : 'online';
        $place = in_array($where['place'] ?? '', self::PLACES, true) ? $where['place'] : 'other';
        $now = date('Y-m-d H:i:s');

        /*
         * 🚨 The discussion id comes from the visitor's URL, so it can name a
         * discussion that was deleted, never existed, or that this person
         * cannot see. The first two break the foreign key and 500 the
         * heartbeat; the third should not be recorded at all. One query
         * settles all three.
         */
        $discussionId = $this->positiveOrNull($where['discussionId'] ?? null);
        if ($discussionId && ! ($actor && Discussion::whereVisibleTo($actor)->where('discussions.id', $discussionId)->exists())) {
            $discussionId = null;
        }
        if (! $discussionId && in_array($place, ['discussion', 'reply'], true)) {
            $place = 'other';
        }

        $existing = $this->db->table('parley_presence')->where('visitor_key', $visitorKey)->first(['status', 'away_since', 'last_seen_at', 'place', 'discussion_id', 'tag_id']);
        $wasOnline = $existing && strtotime((string) $existing->last_seen_at) >= time() - self::WINDOW;
        $member = $actor && ! $actor->isGuest();

        // Away keeps the moment it started, so the list can say "idle 14m"
        // instead of resetting the clock on every heartbeat.
        $awaySince = null;
        if ($status === 'away') {
            $awaySince = ($existing && $existing->status === 'away' && $existing->away_since)
                ? $existing->away_since
                : $now;
        }

        $this->db->table('parley_presence')->updateOrInsert(
            ['visitor_key' => $visitorKey],
            [
                'user_id' => $actor && ! $actor->isGuest() ? $actor->id : null,
                'status' => $status,
                'place' => $place,
                'discussion_id' => $discussionId,
                'near_number' => $discussionId ? $this->positiveOrNull($where['near'] ?? null) : null,
                'tag_id' => $this->positiveOrNull($where['tagId'] ?? null),
                'away_since' => $awaySince,
                'last_seen_at' => $now,
            ]
        );

        // Pruned on write, now and then. Rows past the window are already
        // ignored by every read, so this is housekeeping, not correctness.
        if (random_int(1, 40) === 1) {
            $this->db->table('parley_presence')
                ->where('last_seen_at', '<', date('Y-m-d H:i:s', time() - 600))
                ->delete();
        }

        if (! $member) {
            return '';
        }
        if (! $wasOnline || $existing->status !== $status) {
            return 'list';
        }
        if ($existing->place !== $place || (int) $existing->discussion_id !== (int) $discussionId || (int) $existing->tag_id !== (int) $this->positiveOrNull($where['tagId'] ?? null)) {
            return 'moved';
        }

        return '';
    }

    /**
     * Leaving the site: drop the row now instead of waiting out the window.
     *
     * @return bool whether a member left the list
     */
    public function leave(string $visitorKey): bool
    {
        $wasMember = $this->db->table('parley_presence')->where('visitor_key', $visitorKey)->whereNotNull('user_id')->exists();
        $this->db->table('parley_presence')->where('visitor_key', $visitorKey)->delete();

        return $wasMember;
    }

    /**
     * Every member row inside the window, newest first.
     *
     * @return list<object>
     */
    public function onlineMembers(): array
    {
        return $this->db->table('parley_presence')
            ->whereNotNull('user_id')
            ->where('last_seen_at', '>=', $this->cutoff())
            ->orderByDesc('last_seen_at')
            ->get()
            ->all();
    }

    public function guestCount(): int
    {
        return $this->db->table('parley_presence')
            ->whereNull('user_id')
            ->where('last_seen_at', '>=', $this->cutoff())
            ->count();
    }

    public function isOnline(int $userId): bool
    {
        return $this->db->table('parley_presence')
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $this->cutoff())
            ->where('status', '!=', 'invisible')
            ->exists();
    }

    /** @param  int[]  $userIds  @return array<int, true> */
    public function onlineAmong(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return array_fill_keys(
            $this->db->table('parley_presence')
                ->whereIn('user_id', $userIds)
                ->where('last_seen_at', '>=', $this->cutoff())
                ->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
            true
        );
    }

    /**
     * Someone's status right now: online | away | busy | invisible, or null
     * when they are not on the site. Parley Calls asks before ringing.
     */
    public function statusOf(int $userId): ?string
    {
        $status = $this->db->table('parley_presence')
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $this->cutoff())
            ->value('status');

        return $status === null ? null : (string) $status;
    }

    public function visitorKey(?User $actor, string $sessionId): string
    {
        if ($actor && ! $actor->isGuest()) {
            return 'u'.$actor->id;
        }

        // Hashed: a guest is counted, never identified, and a session id is a
        // credential with no business sitting in a table.
        return 'g'.substr(hash('sha256', $sessionId), 0, 40);
    }

    private function cutoff(): string
    {
        return date('Y-m-d H:i:s', time() - self::WINDOW);
    }

    private function positiveOrNull(mixed $value): ?int
    {
        $int = (int) $value;

        return $int > 0 ? $int : null;
    }
}
