<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Inbox;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/**
 * A conversation and a page of its messages.
 *
 * ?before=<id> pages back through history; ?around=<id> opens a search result
 * in its place; ?after=<id> is the polling path
 * when realtime is not installed. Both page by message id, never by time, so
 * two messages sent in the same second cannot fall between polls.
 */
class ShowConversationController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected Conversations $conversations,
        protected Inbox $inbox
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        $before = (int) $this->query($request, 'before') ?: null;
        $after = (int) $this->query($request, 'after') ?: null;
        $around = (int) $this->query($request, 'around') ?: null;

        return [
            'conversation' => $this->inbox->summary($conversation, $actor),
            'messages' => $this->conversations->messages((int) $conversation->id, $before, $after, $around),
        ];
    }
}
