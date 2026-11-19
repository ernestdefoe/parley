<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

class ReactController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        return ['message' => $this->conversations->react($this->routeId($request), $actor, (string) $this->input($request, 'emoji', ''))];
    }
}
