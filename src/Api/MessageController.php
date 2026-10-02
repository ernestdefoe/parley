<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/** PATCH edits your message; DELETE removes it for everyone. */
class MessageController extends Controller
{
    public function __construct(
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $id = $this->routeId($request);

        $message = $request->getMethod() === 'DELETE'
            ? $this->conversations->delete($id, $actor)
            : $this->conversations->edit($id, $actor, (string) $this->input($request, 'body', ''));

        return ['message' => $message];
    }
}
