<?php

namespace Ernestdefoe\Parley\Realtime;

/**
 * Where Broadcaster's pushes go. Bound to NoChannel; extend.php binds
 * PusherChannel instead only while flarum/realtime is enabled
 * (Extend\Conditional, RealtimeServiceProvider), so nothing here touches a
 * realtime class on a forum without it.
 */
interface Channel
{
    /** Whether pushes reach browsers at all; without it the client polls. */
    public function available(): bool;

    /**
     * @param  list<string>|string  $channels
     * @param  array<string, mixed>  $payload
     */
    public function trigger(array|string $channels, string $event, array $payload): void;
}
