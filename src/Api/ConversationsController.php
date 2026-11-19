<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Inbox;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ServerRequestInterface;

/**
 * GET  — your conversations, newest first: ?filter= one of Conversations::FILTERS, ?offset= to page.
 * POST — open the conversation with one person, creating it on first use.
 */
class ConversationsController extends Controller
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

        if ($request->getMethod() === 'GET') {
            $filter = (string) $this->query($request, 'filter');

            return $this->inbox->listFor(
                $actor,
                in_array($filter, Conversations::FILTERS, true) ? $filter : 'all',
                (int) $this->query($request, 'offset')
            );
        }

        $other = User::query()->whereVisibleTo($actor)->find((int) $this->input($request, 'userId'));
        if (! $other) {
            throw new ModelNotFoundException();
        }

        $conversation = $this->conversations->pair($actor, $other);

        return [
            'conversation' => $this->inbox->summary($conversation, $actor),
            'messages' => $this->conversations->messages((int) $conversation->id),
        ];
    }
}
