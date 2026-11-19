<?php

namespace Ernestdefoe\Parley\Tags;

use Flarum\User\User;

/**
 * What Parley needs from flarum/tags: which tags someone may see, and how a
 * tag looks. Bound to NoTags; extend.php binds FlarumTags instead only while
 * flarum/tags is enabled (Extend\Conditional), so nothing here ever loads a
 * Tags class on a forum without it.
 */
interface TagVisibility
{
    /** @return list<int> the ids of the tags $user may see */
    public function visibleIds(User $user): array;

    /**
     * @param  list<int>  $ids
     * @return array<int, array{name: string, slug: string}> those of $ids $viewer may see
     */
    public function named(User $viewer, array $ids): array;

    /**
     * Which of $users may see tag $tagId: the same answer as visibleIds() per
     * user, in a fixed number of queries however many users there are. Their
     * groups must already be loaded.
     *
     * @param  list<User>  $users
     * @return list<int> the ids of those who may, in the order given
     */
    public function whoCanSee(int $tagId, array $users): array;

    /** @return array<int, array{icon: ?string, color: ?string}> every tag's icon and colour */
    public function looks(): array;
}
