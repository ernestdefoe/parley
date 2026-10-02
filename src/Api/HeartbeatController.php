<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\OnlineList;
use Ernestdefoe\Parley\PresenceStore;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/**
 * One request every 30 seconds does all of it: say where you are, get back the
 * online list and your unread counts. Splitting these would double the
 * requests to say the same thing.
 *
 * Guests beat too, so the list can say "and 41 guests reading", but get
 * nothing back.
 */
class HeartbeatController extends Controller
{
    public function __construct(
        protected PresenceStore $presence,
        protected OnlineList $list,
        protected Conversations $conversations,
        protected Gate $gate
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $session = $request->getAttribute('session');
        $key = $this->presence->visitorKey($actor, $session ? $session->getId() : (string) $request->getAttribute('ipAddress'));
        $body = $this->body($request);

        if ($actor->isGuest() || ! $this->gate->canUse($actor)) {
            $this->presence->beat($key, $actor->isGuest() ? null : $actor, ['place' => $body['place'] ?? null]);

            return ['ok' => true];
        }

        $status = (string) ($body['status'] ?? 'online');
        $this->presence->beat($key, $actor, $body);

        // Online, Busy and Appear offline are choices and outlive the session.
        // Away is worked out by the browser from idle time, so it is not saved.
        if (in_array($status, ['online', 'busy', 'invisible'], true) && $actor->getPreference('parleyStatus') !== $status) {
            $actor->setPreference('parleyStatus', $status);
            $actor->save();
        }

        return $this->list->for($actor) + [
            'unread' => (object) $this->conversations->unreadCounts($actor->id),
        ];
    }
}
