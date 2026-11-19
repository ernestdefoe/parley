<?php

namespace Ernestdefoe\Parley\Realtime;

use Illuminate\Contracts\Container\Container;

/**
 * flarum/realtime is enabled: pushes go through the Pusher client it binds.
 * The client is made when the first push is sent, not when Parley boots.
 */
class PusherChannel implements Channel
{
    public function __construct(
        protected Container $container
    ) {
    }

    public function available(): bool
    {
        return $this->container->bound(\Pusher\Pusher::class);
    }

    public function trigger(array|string $channels, string $event, array $payload): void
    {
        $this->container->make(\Pusher\Pusher::class)->trigger($channels, $event, $payload);
    }
}
