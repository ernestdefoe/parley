<?php

namespace Ernestdefoe\Parley\Tags;

use Flarum\Tags\Tag;
use Flarum\User\User;

/** flarum/tags is enabled: its own visibility rules decide. */
class FlarumTags implements TagVisibility
{
    public function visibleIds(User $user): array
    {
        return Tag::whereVisibleTo($user)->pluck('tags.id')->map(fn ($id) => (int) $id)->all();
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
