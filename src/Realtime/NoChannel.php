<?php

namespace Ernestdefoe\Parley\Realtime;

/** flarum/realtime is not enabled: nothing is pushed, and the client polls. */
class NoChannel implements Channel
{
    public function available(): bool
    {
        return false;
    }

    public function trigger(array|string $channels, string $event, array $payload): void
    {
    }
}
