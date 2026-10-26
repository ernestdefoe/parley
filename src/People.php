<?php

namespace Ernestdefoe\Parley;

use Flarum\Group\Group;
use Flarum\Http\SlugManager;
use Flarum\User\User;
use Illuminate\Support\Collection;

/**
 * The public face of a member as Parley shows it: a name, an avatar, a badge.
 *
 * One instance per request (bound as a singleton), so the people a request
 * meets are loaded once: a message's author, the alert, the summary and the
 * member list of one answer ask for overlapping people, and each asked the
 * database again.
 */
class People
{
    /** Kept small, so a long-running process never holds a forum's worth. */
    private const KEEP = 300;

    /** @var array<int, User> */
    private array $loaded = [];

    public function __construct(
        protected SlugManager $slugs
    ) {
    }

    /**
     * These members, with their groups, by id: one query for the ones not
     * already met in this request.
     *
     * @param  int[]  $ids
     * @return Collection<int, User>
     */
    public function users(array $ids): Collection
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        $missing = array_values(array_diff($ids, array_keys($this->loaded)));

        if ($missing !== []) {
            if (count($this->loaded) + count($missing) > self::KEEP) {
                $this->loaded = [];
            }
            foreach (User::query()->whereIn('id', $missing)->with('groups')->get() as $user) {
                $this->loaded[(int) $user->id] = $user;
            }
        }

        return collect(array_intersect_key($this->loaded, array_flip($ids)));
    }

    /** Forget someone whose groups or name may just have changed. */
    public function forget(int $id): void
    {
        unset($this->loaded[$id]);
    }

    /** @return array<string, mixed> */
    public function card(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'username' => $user->username,
            'displayName' => $user->display_name,
            'slug' => $this->slugs->forResource(User::class)->toSlug($user),
            'avatarUrl' => $user->avatar_url,
            'badge' => $this->badge($user),
        ];
    }

    /**
     * The first visible group a member belongs to, other than Members. The
     * mockup's "Moderator" chip; a moderator is the one most worth knowing about.
     *
     * @return array{name: string, color: string|null, staff: bool}|null
     */
    private function badge(User $user): ?array
    {
        if (! $user->relationLoaded('groups')) {
            return null;
        }

        /** @var Group|null $group */
        $group = $user->groups
            ->reject(fn (Group $g) => $g->is_hidden || (int) $g->id === Group::MEMBER_ID)
            ->sortBy('id')
            ->first();

        if (! $group) {
            return null;
        }

        return [
            'name' => $group->name_singular,
            'color' => $group->color ?: null,
            'staff' => in_array((int) $group->id, [Group::ADMINISTRATOR_ID, Group::MODERATOR_ID], true),
        ];
    }
}
