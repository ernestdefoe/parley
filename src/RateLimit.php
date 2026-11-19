<?php

namespace Ernestdefoe\Parley;

use Flarum\Post\Exception\FloodingException;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * A fixed-window counter per person and action. add() starts the window
 * atomically and increment() is atomic on every cache store Flarum ships, so
 * two requests in parallel cannot both slip under the limit.
 */
class RateLimit
{
    public function __construct(
        protected Cache $cache
    ) {
    }

    /**
     * Count one more $action by $userId; refuse once $max is passed within $seconds.
     *
     * @throws FloodingException
     */
    public function hit(string $action, int $userId, int $max, int $seconds): void
    {
        $key = 'parley.limit.'.$action.'.'.$userId;
        $this->cache->add($key, 0, $seconds);

        if ((int) $this->cache->increment($key) > $max) {
            throw new FloodingException();
        }
    }
}
