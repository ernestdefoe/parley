<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

/** read · typing · hide · mute, all on a conversation you are in. */
class ConversationActionController extends Controller
{
    public function __construct(
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        match (Arr::get($request->getQueryParams(), 'action')) {
            'read' => $this->conversations->markRead($conversation, $actor, (int) $this->input($request, 'messageId')),
            'typing' => $this->conversations->typing($conversation, $actor),
            'hide' => $this->conversations->hide($conversation, $actor),
            'mute' => $this->conversations->setMuted($conversation, $actor, (bool) $this->input($request, 'on', true)),
        };

        return ['ok' => true];
    }
}
