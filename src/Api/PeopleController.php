<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\People;
use Ernestdefoe\Parley\PresenceStore;
use Ernestdefoe\Parley\Relations;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Find someone to message who is not in the online list. The rail's search
 * filters the list first and falls back to this when nobody online matches.
 */
class PeopleController extends Controller
{
    public function __construct(
        protected People $people,
        protected Relations $relations,
        protected Gate $gate,
        protected PresenceStore $presence
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        $q = trim((string) $this->query($request, 'q'));
        if (mb_strlen($q) < 2) {
            return ['people' => []];
        }

        $blocked = $this->relations->blockedEitherWay($actor->id);
        $like = '%'.addcslashes($q, '%_\\').'%';

        $users = User::query()->whereVisibleTo($actor)
            // Display names are worked out by a driver, not stored, so the
            // username is what can be searched.
            ->where('users.username', 'like', $like)
            ->where('users.id', '!=', $actor->id)
            ->with('groups')
            ->orderBy('users.username')
            ->limit(16)
            ->get()
            ->reject(fn (User $u) => isset($blocked[(int) $u->id]) || ! $this->gate->canUseInBulk($u))
            ->take(8);

        $online = $this->presence->onlineAmong($users->pluck('id')->map(fn ($id) => (int) $id)->all());

        return ['people' => $users->map(fn (User $u) => $this->people->card($u) + [
            'online' => isset($online[(int) $u->id]),
        ])->values()->all()];
    }
}
