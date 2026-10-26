<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\AbstractServiceProvider;

class ParleyServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        // One per request: it remembers the people the request has met.
        $this->container->singleton(People::class);
    }
}
