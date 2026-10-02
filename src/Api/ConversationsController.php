<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ServerRequestInterface;

/**
 * GET  — your conversations, newest first.
 * POST — open the conversation with one person, creating it on first use.
 */
class ConversationsController extends Controller
{
    public function __construct(
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        if ($request->getMethod() === 'GET') {
            return ['conversations' => $this->conversations->listFor($actor)];
        }

        $other = User::query()->whereVisibleTo($actor)->find((int) $this->input($request, 'userId'));
        if (! $other) {
            throw new ModelNotFoundException();
        }

        $conversation = $this->conversations->pair($actor, $other);

        return [
            'conversation' => $this->conversations->summary($conversation, $actor),
            'messages' => $this->conversations->messages((int) $conversation->id),
        ];
    }
}
