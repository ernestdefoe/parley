<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Rooms;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Members: list rooms, join, leave.
 * Admins:  create, edit, archive, delete, reorder, and see every room.
 */
class RoomsController extends Controller
{
    public function __construct(
        protected Rooms $rooms,
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $route = $request->getAttribute('routeName');

        if (str_starts_with($route, 'ernestdefoe-parley.rooms.admin')) {
            $actor->assertAdmin();

            return match ($route) {
                'ernestdefoe-parley.rooms.admin' => ['rooms' => $this->rooms->all()],
                'ernestdefoe-parley.rooms.admin.create' => ['room' => $this->rooms->card($this->rooms->save(null, $this->body($request)))],
                'ernestdefoe-parley.rooms.admin.update' => ['room' => $this->rooms->card($this->rooms->save($this->room($request), $this->body($request)))],
                'ernestdefoe-parley.rooms.admin.delete' => $this->destroy($request),
                'ernestdefoe-parley.rooms.admin.order' => $this->order($request),
            };
        }

        $this->member($actor);

        if ($route === 'ernestdefoe-parley.rooms') {
            return ['rooms' => $this->rooms->listFor($actor, $this->conversations->unreadCounts($actor->id))];
        }

        $room = $this->room($request);
        if (! $this->rooms->canView($room, $actor)) {
            throw new ModelNotFoundException();
        }

        $route === 'ernestdefoe-parley.rooms.join'
            ? $this->rooms->join($room, $actor)
            : $this->rooms->leave($room, $actor);

        return ['rooms' => $this->rooms->listFor($actor, $this->conversations->unreadCounts($actor->id))];
    }

    private function room(ServerRequestInterface $request): object
    {
        $room = $this->rooms->find($this->routeId($request));
        if (! $room) {
            throw new ModelNotFoundException();
        }

        return $room;
    }

    private function destroy(ServerRequestInterface $request): array
    {
        $this->rooms->destroy($this->room($request));

        return ['rooms' => $this->rooms->all()];
    }

    private function order(ServerRequestInterface $request): array
    {
        $this->rooms->reorder(array_map('intval', (array) $this->input($request, 'ids', [])));

        return ['rooms' => $this->rooms->all()];
    }
}
