<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\AbstractServiceProvider;

class ParleyServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        // One per request: it remembers the people the request has met.
        $this->container->singleton(People::class);

        // Subclasses of Api\Controller in other extensions (Parley Calls)
        // were written before the Gate was a constructor argument.
        $this->container->afterResolving(Api\Controller::class, fn (Api\Controller $controller, $container) => $controller->withGate($container->make(Gate::class)));

        // No tags unless flarum/tags is enabled; then Tags\TagsServiceProvider
        // replaces this binding.
        if (! $this->container->bound(Tags\TagVisibility::class)) {
            $this->container->singleton(Tags\TagVisibility::class, Tags\NoTags::class);
        }
    }
}
