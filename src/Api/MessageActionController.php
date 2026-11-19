<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\MessageActions;
use Ernestdefoe\Parley\Pins;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/** POST /messages/{id}/pin {on} · POST /messages/{id}/forward {conversationIds} */
class MessageActionController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected MessageActions $messages,
        protected Pins $pins
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $id = $this->routeId($request);

        if ($request->getAttribute('routeName') === 'ernestdefoe-parley.message.forward') {
            return ['messages' => $this->messages->forward($id, $actor, (array) $this->input($request, 'conversationIds', []))];
        }

        return ['message' => $this->pins->set($id, $actor, (bool) $this->input($request, 'on', true))];
    }
}
