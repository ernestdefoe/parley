<?php

namespace Ernestdefoe\Parley\Tags;

use Flarum\Tags\Tag;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/** flarum/tags is enabled: its own visibility rules decide. */
class FlarumTags implements TagVisibility
{
    public function __construct(
        protected ConnectionInterface $db
    ) {
    }

    public function visibleIds(User $user): array
    {
        return Tag::whereVisibleTo($user)->pluck('tags.id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * flarum/tags' rule (Tag::scopeWhereHasPermission with viewForum), worked
     * out once for the tag instead of once per user:
     * - an administrator sees every tag;
     * - a tag that is not restricted is seen by whoever holds viewForum;
     * - a restricted tag by whoever holds `tag<id>.viewForum` (or
     *   `tag<id>.discussion.viewForum`, which flarum/tags accepts too);
     * - a child tag only by those who also see its parent.
     * A user's groups are core's permissionGroupIds(): Guests, plus Members
     * and their own groups once their email is confirmed.
     */
    public function whoCanSee(int $tagId, array $users): array
    {
        if ($users === []) {
            return [];
        }

        $tag = $this->db->table('tags')->where('id', $tagId)->first(['id', 'parent_id', 'is_restricted']);
        $parent = $tag && $tag->parent_id ? $this->db->table('tags')->where('id', $tag->parent_id)->first(['id', 'parent_id', 'is_restricted']) : null;
        if (! $tag || ($tag->parent_id && ! $parent)) {
            return [];
        }

        $chain = array_filter([$tag, $parent]);
        $needed = ['viewForum'];
        foreach ($chain as $t) {
            $needed[] = 'tag'.$t->id.'.viewForum';
            $needed[] = 'tag'.$t->id.'.discussion.viewForum';
        }

        // permission => [group id => true]
        $grants = [];
        foreach ($this->db->table('group_permission')->whereIn('permission', $needed)->get(['group_id', 'permission']) as $row) {
            $grants[$row->permission][(int) $row->group_id] = true;
        }

        $holds = function (array $groupIds, string $permission) use ($grants): bool {
            foreach ($groupIds as $id) {
                if (isset($grants[$permission][(int) $id])) {
                    return true;
                }
            }

            return false;
        };

        $ids = [];
        foreach ($users as $user) {
            if ($user->isAdmin()) {
                $ids[] = (int) $user->id;
                continue;
            }

            $groupIds = $user->permissionGroupIds();
            $sees = fn (object $t) => $t->is_restricted
                ? $holds($groupIds, 'tag'.$t->id.'.viewForum') || $holds($groupIds, 'tag'.$t->id.'.discussion.viewForum')
                : $holds($groupIds, 'viewForum');

            if ($sees($tag) && (! $parent || $sees($parent))) {
                $ids[] = (int) $user->id;
            }
        }

        return $ids;
    }

    public function named(User $viewer, array $ids): array
    {
        $out = [];
        if ($ids === []) {
            return $out;
        }

        foreach (Tag::whereVisibleTo($viewer)->whereIn('tags.id', $ids)->get(['id', 'name', 'slug']) as $tag) {
            $out[(int) $tag->id] = ['name' => $tag->name, 'slug' => $tag->slug];
        }

        return $out;
    }

    public function looks(): array
    {
        $out = [];
        foreach (Tag::query()->get(['id', 'icon', 'color']) as $tag) {
            $out[(int) $tag->id] = ['icon' => $tag->icon ?: null, 'color' => $tag->color ?: null];
        }

        return $out;
    }
}
