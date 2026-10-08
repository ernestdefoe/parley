<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Relations;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

/** follow · block, each switched on or off with {on: bool}. */
class PersonActionController extends Controller
{
    public function __construct(
        protected Relations $relations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        $other = User::query()->whereVisibleTo($actor)->find($this->routeId($request));
        if (! $other || $other->id === $actor->id) {
            throw new ModelNotFoundException();
        }

        $on = (bool) $this->input($request, 'on', true);

        match (Arr::get($request->getQueryParams(), 'action')) {
            'follow' => $this->relations->setFollow($actor->id, $other->id, $on),
            'block' => $this->relations->setBlock($actor->id, $other->id, $on),
            // The route only matches the actions above.
            default => throw new RouteNotFoundException(),
        };

        return [
            'following' => $this->relations->follows($actor->id, $other->id),
            'blocked' => isset($this->relations->blockedBy($actor->id)[$other->id]),
        ];
    }
}
