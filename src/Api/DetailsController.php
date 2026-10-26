<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Groups;
use Ernestdefoe\Parley\Pins;
use Ernestdefoe\Parley\Rooms;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Psr\Http\Message\ServerRequestInterface;

/**
 * The details column: who is in a conversation, and one tab of what has been
 * shared in it — media, files, links or pins — a page at a time. ?tab=members
 * is the member list alone, for @mention suggestions.
 */
class DetailsController extends Controller
{
    public const PAGE = 30;

    public function __construct(
        protected Conversations $conversations,
        protected Groups $groups,
        protected Pins $pins,
        protected Rooms $rooms,
        protected ConnectionInterface $db
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);
        $tab = (string) $this->query($request, 'tab');
        $before = (int) $this->query($request, 'before') ?: null;

        $out = [];

        // Members come with the first page; a room's are not listed here.
        if (! $before && ! $this->rooms->isRoom($conversation)) {
            $out['members'] = $this->groups->members($conversation);
        }

        if ($tab === 'members') {
            return $out;
        }

        if ($tab === 'pins') {
            return $out + ['items' => $this->pins->list((int) $conversation->id), 'hasMore' => false];
        }

        $q = $this->db->table('parley_messages')->where('conversation_id', $conversation->id)->whereNull('deleted_at');

        match ($tab) {
            'files' => $q->whereIn('type', ['file', 'voice']),
            'links' => $q->where('type', 'text')->where(fn (Builder $w) => $w->where('body', 'like', '%http://%')->orWhere('body', 'like', '%https://%')),
            default => $q->whereIn('type', ['image', 'video']),
        };

        if ($before) {
            $q->where('id', '<', $before);
        }

        $rows = $q->orderByDesc('id')->limit(self::PAGE + 1)->get()->all();

        return $out + [
            'items' => $this->conversations->payloads(array_slice($rows, 0, self::PAGE)),
            'hasMore' => count($rows) > self::PAGE,
        ];
    }
}
