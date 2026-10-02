<?php

namespace Ernestdefoe\Parley;

use Illuminate\Database\ConnectionInterface;

/**
 * Follows and blocks. Small tables, read once per request in bulk.
 */
class Relations
{
    public function __construct(
        protected ConnectionInterface $db
    ) {
    }

    /** @return array<int, true> */
    public function followedBy(int $userId): array
    {
        return array_fill_keys(
            $this->db->table('parley_follows')->where('user_id', $userId)
                ->pluck('followed_id')->map(fn ($id) => (int) $id)->all(),
            true
        );
    }

    public function follows(int $userId, int $otherId): bool
    {
        return $this->db->table('parley_follows')
            ->where('user_id', $userId)->where('followed_id', $otherId)->exists();
    }

    public function setFollow(int $userId, int $otherId, bool $on): void
    {
        $q = $this->db->table('parley_follows')->where('user_id', $userId)->where('followed_id', $otherId);

        if (! $on) {
            $q->delete();

            return;
        }

        if (! $q->exists()) {
            $this->db->table('parley_follows')->insert([
                'user_id' => $userId,
                'followed_id' => $otherId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }
    }

    /**
     * Everyone this user has blocked AND everyone who has blocked them. A block
     * is mutual in what it hides: neither side sees the other online, and
     * neither can message the other.
     *
     * @return array<int, true>
     */
    public function blockedEitherWay(int $userId): array
    {
        $mine = $this->db->table('parley_blocks')->where('user_id', $userId)->pluck('blocked_id');
        $theirs = $this->db->table('parley_blocks')->where('blocked_id', $userId)->pluck('user_id');

        return array_fill_keys($mine->merge($theirs)->map(fn ($id) => (int) $id)->unique()->all(), true);
    }

    /** @return array<int, true> only the ones this user chose */
    public function blockedBy(int $userId): array
    {
        return array_fill_keys(
            $this->db->table('parley_blocks')->where('user_id', $userId)
                ->pluck('blocked_id')->map(fn ($id) => (int) $id)->all(),
            true
        );
    }

    public function isBlockedEitherWay(int $a, int $b): bool
    {
        return $this->db->table('parley_blocks')
            ->where(fn ($q) => $q->where('user_id', $a)->where('blocked_id', $b))
            ->orWhere(fn ($q) => $q->where('user_id', $b)->where('blocked_id', $a))
            ->exists();
    }

    public function setBlock(int $userId, int $otherId, bool $on): void
    {
        $q = $this->db->table('parley_blocks')->where('user_id', $userId)->where('blocked_id', $otherId);

        if (! $on) {
            $q->delete();

            return;
        }

        if (! $q->exists()) {
            $this->db->table('parley_blocks')->insert([
                'user_id' => $userId,
                'blocked_id' => $otherId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // Blocking someone also stops following them.
        $this->setFollow($userId, $otherId, false);
    }
}
