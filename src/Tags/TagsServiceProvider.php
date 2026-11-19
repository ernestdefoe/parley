<?php

namespace Ernestdefoe\Parley\Tags;

use Flarum\Foundation\AbstractServiceProvider;

/** Registered only while flarum/tags is enabled (see extend.php). */
class TagsServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(TagVisibility::class, FlarumTags::class);
    }
}
