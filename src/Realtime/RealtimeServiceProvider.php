<?php

namespace Ernestdefoe\Parley\Realtime;

use Flarum\Foundation\AbstractServiceProvider;

/** Registered only while flarum/realtime is enabled (see extend.php). */
class RealtimeServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(Channel::class, PusherChannel::class);
    }
}
