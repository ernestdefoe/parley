<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Flarum\User\User;
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
        protected RateLimit $rateLimit
    ) {
    }

    /**
     * @param  array{q?: string, conversation?: int|null, from?: int|null, type?: string|null, since?: string|null, until?: string|null, before?: int|null}  $filters
     * @return array{messages: list<array<string, mixed>>, conversations: list<array<string, mixed>>, hasMore: bool}
     */
    public function run(User $actor, array $filters): array
    {
        // Thirty searches a minute is a person typing; more is a scraper.
        $this->rateLimit->hit('search', (int) $actor->id, 30, 60);

        $words = trim((string) ($filters['q'] ?? ''));
        $type = $filters['type'] ?? null;
        $type = is_string($type) && isset(self::TYPES[$type]) ? $type : null;

        $conversationId = ! empty($filters['conversation'])
            ? (int) $this->conversations->find((int) $filters['conversation'], $actor)->id
            : null;

        $narrowed = $words !== '' || $type || ! empty($filters['from']) || ! empty($filters['since']) || ! empty($filters['until']);
        if (! $narrowed || ($words !== '' && mb_strlen($words) < 2)) {
            return ['messages' => [], 'conversations' => [], 'hasMore' => false];
        }

        $q = $this->db->table('parley_messages')
            ->whereNull('deleted_at')
            ->whereIn('type', $type ? self::TYPES[$type] : Conversations::CONTENT);

        $conversationId ? $q->where('conversation_id', $conversationId) : $this->scope($q, $actor);
        $this->matching($q, $words, $type === 'link');
        $this->filtered($q, $filters);

        $rows = $q->orderByDesc('id')->limit(self::PAGE + 1)->get()->all();
        $messages = $this->conversations->payloads(array_slice($rows, 0, self::PAGE));
        $ids = array_values(array_unique(array_map(fn ($m) => $m['conversationId'], $messages)));

        return [
            'messages' => $messages,
            'conversations' => $this->conversations->summariesFor($ids, $actor),
            'hasMore' => count($rows) > self::PAGE,
        ];
    }

    /** The words, and whether only messages with a link. */
    private function matching(Builder $q, string $words, bool $links): void
    {
        if ($words !== '') {
            // A word can be anywhere in a message ("nana" finds "banana"), so
            // this stays a substring match: no index serves it, and a prefix
            // match on words would need a word index Parley does not keep.
            // It is bounded instead: only the searcher's own conversations
            // (conversation_id is indexed), only content types, newest first,
            // and it stops at one page.
            // PostgreSQL's LIKE minds case; MySQL's and SQLite's do not.
            $like = $this->db->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $q->where('body', $like, '%'.addcslashes($words, '%_\\').'%');
        }
        if ($links) {
            // Set when the message is sent, so this needs no text scan.
            $q->where('has_link', true);
        }
    }

    /** @param  array{from?: int|null, since?: string|null, until?: string|null, before?: int|null}  $filters */
    private function filtered(Builder $q, array $filters): void
    {
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
    }

    /**
     * Only conversations this person may search. Direct and group
     * conversations they are in come from a subquery, so no id list grows
     * with them. Whether a room may still be read depends on tag permissions
     * worked out in PHP, so the rooms they joined (a handful, made by admins)
     * are checked one by one and passed by id.
     */
    private function scope(Builder $q, User $actor): void
    {
        $rooms = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $actor->id)
            ->where('c.type', 'room')
            ->get(['c.*'])
            ->filter(fn ($c) => $this->rooms->canChat($c, $actor))
            ->map(fn ($c) => (int) $c->id)->values()->all();

        $q->where(function (Builder $w) use ($actor, $rooms) {
            $w->whereIn('conversation_id', fn (Builder $s) => $s->select('p.conversation_id')
                ->from('parley_participants as p')
                ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
                ->where('p.user_id', $actor->id)
                ->where('c.type', '!=', 'room'));
            if ($rooms !== []) {
                $w->orWhereIn('conversation_id', $rooms);
            }
        });
    }

    private function date(?string $value): ?Carbon
    {
        if (! $value || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return null;
        }

        return Carbon::createFromDate((int) $m[1], (int) $m[2], (int) $m[3]);
    }
}
