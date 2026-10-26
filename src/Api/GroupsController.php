<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Groups;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

/**
 * POST   /groups                          — start a group: userIds, name
 * PATCH  /conversations/{id}              — rename it
 * POST   /conversations/{id}/photo        — set its photo; DELETE to remove
 * POST   /conversations/{id}/members      — add people: userIds
 * DELETE /conversations/{id}/members/{u}  — remove someone, or leave
 */
class GroupsController extends Controller
{
    public function __construct(
        protected Groups $groups,
        protected Conversations $conversations
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $route = (string) $request->getAttribute('routeName');

        if ($route === 'ernestdefoe-parley.groups.create') {
            $group = $this->groups->create($actor, (array) $this->input($request, 'userIds', []), $this->input($request, 'name'));

            return [
                'conversation' => $this->conversations->summary($group, $actor),
                'messages' => $this->conversations->messages((int) $group->id),
            ];
        }

        $group = $this->conversations->find($this->routeId($request), $actor);

        match ($route) {
            'ernestdefoe-parley.groups.rename' => $this->groups->rename($group, $actor, $this->input($request, 'name')),
            'ernestdefoe-parley.groups.photo' => $this->groups->setPhoto($group, $actor, $this->file($request) ?? throw new \Flarum\Foundation\ValidationException(['photo' => resolve(\Flarum\Locale\TranslatorInterface::class)->trans('ernestdefoe-parley.api.no_file')])),
            'ernestdefoe-parley.groups.photo.delete' => $this->groups->setPhoto($group, $actor, null),
            'ernestdefoe-parley.groups.members.add' => $this->groups->add($group, $actor, (array) $this->input($request, 'userIds', [])),
            'ernestdefoe-parley.groups.members.remove' => $this->groups->remove($group, $actor, $this->routeId($request, 'userId')),
            default => throw new \Flarum\Http\Exception\RouteNotFoundException(),
        };

        // Someone who has just left no longer sees it.
        if ($route === 'ernestdefoe-parley.groups.members.remove' && $this->routeId($request, 'userId') === $actor->id) {
            return ['ok' => true, 'left' => true];
        }

        // Read again for the new name or photo; membership was checked above.
        $fresh = $this->conversations->row((int) $group->id) ?? $group;

        return [
            'conversation' => $this->conversations->summary($fresh, $actor),
            'members' => $this->groups->members($group),
        ];
    }

    private function file(ServerRequestInterface $request): ?\Psr\Http\Message\UploadedFileInterface
    {
        $file = Arr::get($request->getUploadedFiles(), 'photo');

        return $file instanceof \Psr\Http\Message\UploadedFileInterface ? $file : null;
    }
}
