<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\MessageActions;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

class ReactController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected MessageActions $messages
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        return ['message' => $this->messages->react($this->routeId($request), $actor, (string) $this->input($request, 'emoji', ''))];
    }
}
