<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

class SendMessageController extends Controller
{
    public function __construct(
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        $message = $this->conversations->send(
            $conversation,
            $actor,
            'text',
            (string) $this->input($request, 'body', ''),
            null,
            (int) $this->input($request, 'replyToId') ?: null
        );

        return ['message' => $message];
    }
}
