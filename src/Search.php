<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Flarum\Post\Exception\FloodingException;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * Finding messages: in one conversation, or across all of yours, by words,
 * person, date and type.
 *
 * 🚨 Only ever conversations the searcher is in: their direct and group
 * conversations, and rooms they have joined AND can still see. Nothing is
 * searched first and filtered after, so a hidden room's words cannot show
 * up, even as a count.
 */
class Search
{
    public const PAGE = 30;

    /** What the type filter offers, and the message types each covers. */
    public const TYPES = [
        'text' => ['text'],
        'media' => ['image', 'video'],
        'voice' => ['voice'],
        'file' => ['file'],
        'link' => ['text'],
    ];

    public function __construct(
        protected ConnectionInterface $db,
        protected Conversations $conversations,
        protected Rooms $rooms,
        protected Cache $cache
    ) {
    }

    /**
     * @param  array{q?: string, conversation?: int|null, from?: int|null, type?: string|null, since?: string|null, until?: string|null, before?: int|null}  $filters
     * @return array{messages: list<array<string, mixed>>, conversations: list<array<string, mixed>>, hasMore: bool}
     */
    public function run(User $actor, array $filters): array
    {
        // Thirty searches a minute is a person typing; more is a scraper.
        $key = 'parley.search.'.$actor->id;
        $count = (int) $this->cache->get($key, 0);
        if ($count >= 30) {
            throw new FloodingException();
        }
        $this->cache->put($key, $count + 1, 60);

        $words = trim((string) ($filters['q'] ?? ''));
        $type = $filters['type'] ?? null;
        $type = isset(self::TYPES[$type]) ? $type : null;

        $scope = ! empty($filters['conversation'])
            ? [(int) $this->conversations->find((int) $filters['conversation'], $actor)->id]
            : $this->scope($actor);

        $narrowed = $words !== '' || $type || ! empty($filters['from']) || ! empty($filters['since']) || ! empty($filters['until']);
        if ($scope === [] || ! $narrowed || ($words !== '' && mb_strlen($words) < 2)) {
            return ['messages' => [], 'conversations' => [], 'hasMore' => false];
        }

        $q = $this->db->table('parley_messages')
            ->whereIn('conversation_id', $scope)
            ->whereNull('deleted_at')
            ->whereIn('type', $type ? self::TYPES[$type] : Conversations::CONTENT);

        if ($words !== '') {
            // PostgreSQL's LIKE minds case; MySQL's and SQLite's do not.
            $like = $this->db->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $q->where('body', $like, '%'.addcslashes($words, '%_\\').'%');
        }
        if ($type === 'link') {
            $q->where(fn (Builder $w) => $w->where('body', 'like', '%http://%')->orWhere('body', 'like', '%https://%'));
        }
        if (! empty($filters['from'])) {
            $q->where('user_id', (int) $filters['from']);
        }
        if ($since = $this->date($filters['since'] ?? null)) {
            $q->where('created_at', '>=', $since->startOfDay()->toDateTimeString());
        }
        if ($until = $this->date($filters['until'] ?? null)) {
            $q->where('created_at', '<=', $until->endOfDay()->toDateTimeString());
        }
        if (! empty($filters['before'])) {
            $q->where('id', '<', (int) $filters['before']);
        }

        $rows = $q->orderByDesc('id')->limit(self::PAGE + 1)->get()->all();
        $messages = $this->conversations->payloads(array_slice($rows, 0, self::PAGE));
        $ids = array_values(array_unique(array_map(fn ($m) => $m['conversationId'], $messages)));

        return [
            'messages' => $messages,
            'conversations' => $this->conversations->summariesFor($ids, $actor),
            'hasMore' => count($rows) > self::PAGE,
        ];
    }

    /** @return int[] every conversation this person may search */
    private function scope(User $actor): array
    {
        $rows = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $actor->id)
            ->get(['c.*']);

        return $rows->filter(fn ($c) => ! $this->rooms->isRoom($c) || $this->rooms->canChat($c, $actor))
            ->map(fn ($c) => (int) $c->id)->values()->all();
    }

    private function date(?string $value): ?Carbon
    {
        if (! $value || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
