<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Inbox;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\GroupPhotos;
use Ernestdefoe\Parley\RoomImages;
use Ernestdefoe\Parley\Rooms;
use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Members: list rooms, join, leave.
 * Admins:  create, edit, archive, delete, reorder, and see every room.
 */
class RoomsController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected Rooms $rooms,
        protected Inbox $inbox,
        protected RoomImages $images,
        protected TranslatorInterface $translator
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
                'ernestdefoe-parley.rooms.admin.image' => $this->image($request),
                'ernestdefoe-parley.rooms.admin.image.delete' => $this->removeImage($request),
                // The routes registered under this prefix are all listed above.
                default => throw new RouteNotFoundException(),
            };
        }

        $this->member($actor);

        if ($route === 'ernestdefoe-parley.rooms') {
            $parent = (int) $this->query($request, 'parent') ?: null;

            return ['rooms' => $this->rooms->listFor($actor, $this->inbox->unreadCounts($actor->id), $parent)];
        }

        $room = $this->room($request);
        if (! $this->rooms->canView($room, $actor)) {
            throw new ModelNotFoundException();
        }

        $route === 'ernestdefoe-parley.rooms.join'
            ? $this->rooms->join($room, $actor)
            : $this->rooms->leave($room, $actor);

        return ['rooms' => $this->rooms->listFor($actor, $this->inbox->unreadCounts($actor->id))];
    }

    private function room(ServerRequestInterface $request): object
    {
        $room = $this->rooms->find($this->routeId($request));
        // A room another extension owns is not Parley's to show or change.
        if (! $room || $this->rooms->isOwned($room)) {
            throw new ModelNotFoundException();
        }

        return $room;
    }

    private function destroy(ServerRequestInterface $request): array
    {
        $this->rooms->destroy($this->room($request));

        return ['rooms' => $this->rooms->all()];
    }

    private function image(ServerRequestInterface $request): array
    {
        $room = $this->room($request);
        $file = \Illuminate\Support\Arr::get($request->getUploadedFiles(), 'image');

        // The same cap as a group photo: one constant, GroupPhotos::MAX_MB.
        if (! $file instanceof UploadedFileInterface || $file->getError() !== UPLOAD_ERR_OK || $file->getSize() > GroupPhotos::MAX_MB * 1024 * 1024) {
            throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.room_image_type', ['max' => GroupPhotos::MAX_MB])]);
        }

        $this->images->set($room, (string) $file->getStream(), $this->query($request, 'variant') === 'dark' ? 'dark' : 'light');

        return ['rooms' => $this->rooms->all()];
    }

    private function removeImage(ServerRequestInterface $request): array
    {
        $variant = $this->query($request, 'variant');
        $this->images->remove($this->room($request), in_array($variant, ['light', 'dark'], true) ? $variant : 'both');

        return ['rooms' => $this->rooms->all()];
    }

    private function order(ServerRequestInterface $request): array
    {
        $this->rooms->reorder(array_map('intval', (array) $this->input($request, 'ids', [])));

        return ['rooms' => $this->rooms->all()];
    }
}
