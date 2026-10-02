<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/**
 * A conversation and a page of its messages.
 *
 * ?before=<id> pages back through history; ?after=<id> is the polling path
 * when realtime is not installed. Both page by message id, never by time, so
 * two messages sent in the same second cannot fall between polls.
 */
class ShowConversationController extends Controller
{
    public function __construct(
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        $before = (int) $this->query($request, 'before') ?: null;
        $after = (int) $this->query($request, 'after') ?: null;

        return [
            'conversation' => $this->conversations->summary($conversation, $actor),
            'messages' => $this->conversations->messages((int) $conversation->id, $before, $after),
        ];
    }
}
