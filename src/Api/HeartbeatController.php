<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Broadcaster;
use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\OnlineList;
use Ernestdefoe\Parley\PresenceStore;
use Ernestdefoe\Parley\Rooms;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Http\Message\ServerRequestInterface;

/**
 * One request every 30 seconds does all of it: say where you are, get back the
 * online list, the rooms and your unread counts.
 *
 * When this beat changed the list — someone arrived, left or changed status —
 * a nameless signal goes out over realtime and every open page refreshes its
 * list at once, so the list is live without the 30 seconds in between.
 *
 * Guests beat too, so the list can say "and 41 guests reading", but get
 * nothing back.
 */
class HeartbeatController extends Controller
{
    /** At most one "the list changed" signal this often, however busy the site. */
    private const SIGNAL_EVERY = 3;

    public function __construct(
        protected PresenceStore $presence,
        protected OnlineList $list,
        protected Conversations $conversations,
        protected Rooms $rooms,
        protected Gate $gate,
        protected Broadcaster $broadcaster,
        protected Cache $cache
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $session = $request->getAttribute('session');
        $key = $this->presence->visitorKey($actor, $session ? $session->getId() : (string) $request->getAttribute('ipAddress'));
        $body = $this->body($request);

        // A page closing says goodbye, so it leaves the list now rather than
        // fading out over the next 90 seconds.
        if ($request->getAttribute('routeName') === 'ernestdefoe-parley.leave') {
            if ($this->presence->leave($key)) {
                $this->signal();
            }

            return ['ok' => true];
        }

        if ($actor->isGuest() || ! $this->gate->canUse($actor)) {
            $this->presence->beat($key, $actor->isGuest() ? null : $actor, ['place' => $body['place'] ?? null]);

            return ['ok' => true];
        }

        $status = (string) ($body['status'] ?? 'online');
        if ($this->presence->beat($key, $actor, $body)) {
            $this->signal();
        }

        // Online, Busy and Appear offline are choices and outlive the session.
        // Away is worked out by the browser from idle time, so it is not saved.
        if (in_array($status, ['online', 'busy', 'invisible'], true) && $actor->getPreference('parleyStatus') !== $status) {
            $actor->setPreference('parleyStatus', $status);
            $actor->save();
        }

        $unread = $this->conversations->unreadCounts($actor->id);

        return $this->list->for($actor) + [
            'rooms' => $this->rooms->listFor($actor, $unread),
            'unread' => (object) $unread,
        ];
    }

    private function signal(): void
    {
        if ($this->cache->add('parley.presence.signal', 1, self::SIGNAL_EVERY)) {
            $this->broadcaster->toEveryone('presence');
        }
    }
}
