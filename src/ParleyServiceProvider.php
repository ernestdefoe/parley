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

        // What other extensions add to rooms: one registry per container.
        $this->container->singleton(RoomRegistry::class);

        // No tags unless flarum/tags is enabled; then Tags\TagsServiceProvider
        // replaces this binding.
        if (! $this->container->bound(Tags\TagVisibility::class)) {
            $this->container->singleton(Tags\TagVisibility::class, Tags\NoTags::class);
        }

        // No pushes unless flarum/realtime is enabled; then
        // Realtime\RealtimeServiceProvider replaces this binding.
        if (! $this->container->bound(Realtime\Channel::class)) {
            $this->container->singleton(Realtime\Channel::class, Realtime\NoChannel::class);
        }
    }
}
