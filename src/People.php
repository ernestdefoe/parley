<?php

namespace Ernestdefoe\Parley;

use Flarum\Group\Group;
use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * The public face of a member as Parley shows it: a name, an avatar, a badge.
 */
class People
{
    public function __construct(
        protected SlugManager $slugs
    ) {
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
