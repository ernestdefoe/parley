<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\MessageActions;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/** PATCH edits your message; DELETE removes it for everyone. */
class MessageController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected MessageActions $messages
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $id = $this->routeId($request);

        $message = $request->getMethod() === 'DELETE'
            ? $this->messages->delete($id, $actor)
            : $this->messages->edit($id, $actor, (string) $this->input($request, 'body', ''));

        return ['message' => $message];
    }
}
