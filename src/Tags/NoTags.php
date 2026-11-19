<?php

namespace Ernestdefoe\Parley\Tags;

use Flarum\User\User;

/** flarum/tags is not enabled: no tags, so no room is tied to one. */
class NoTags implements TagVisibility
{
    public function visibleIds(User $user): array
    {
        return [];
    }

    public function named(User $viewer, array $ids): array
    {
        return [];
    }

    public function whoCanSee(int $tagId, array $users): array
    {
        return [];
    }

    public function looks(): array
    {
        return [];
    }
}
