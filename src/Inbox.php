<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * The inbox: a person's conversations as summaries, and what is unread in
 * them. Each list is built in a fixed number of queries however long it is.
 */
class Inbox
{
    /** How many people a group conversation's summary carries; the details column loads the rest. */
    private const GROUP_FACES = 4;

    /** The participant columns that are one person's own view of a conversation. */
    private const MINE = ['last_read_message_id', 'muted', 'archived_at', 'starred', 'label', 'role', 'requested_at', 'last_mention_id'];

    public function __construct(
        protected ConnectionInterface $db,
        protected People $people,
        protected PresenceStore $presence,
        protected Rooms $rooms,
        protected GroupPhotos $photos,
        protected MessagePayloads $payloads
    ) {
    }

    /**
     * The viewer's conversations, newest activity first, in a fixed number of
     * queries.
     *
     * @return array{conversations: list<array<string, mixed>>, hasMore: bool}
     */
    public function listFor(User $viewer, string $filter = 'all', int $offset = 0, int $limit = 30): array
    {
        $q = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $viewer->id)
            ->where('c.type', 'direct')
            ->whereNotNull('c.last_message_id')
            ->where(fn ($q) => $q->whereNull('p.hidden_at')->orWhereColumn('c.last_message_at', '>', 'p.hidden_at'));

        // Requests wait in their own list, and the archive keeps its own;
        // every other filter is a slice of the inbox proper.
        if ($filter === 'requests') {
            $q->whereNotNull('p.requested_at');
        } else {
            $q->whereNull('p.requested_at');
            $filter === 'archived' ? $q->whereNotNull('p.archived_at') : $q->whereNull('p.archived_at');
        }

        match ($filter) {
            'unread' => $q->whereNotNull('c.last_message_id')->where(fn ($w) => $w->whereNull('p.last_read_message_id')->orWhereColumn('c.last_message_id', '>', 'p.last_read_message_id')),
            'groups' => $q->where('c.is_group', true),
            'mentions' => $q->whereNotNull('p.last_mention_id'),
            'pinned' => $q->whereExists(fn ($w) => $w->from('parley_pins as pin')->whereColumn('pin.conversation_id', 'c.id')),
            'starred' => $q->where('p.starred', true),
            'muted' => $q->where('p.muted', true),
            default => null,
        };

        $rows = $q->orderByDesc('c.last_message_at')->orderByDesc('c.id')
            ->offset(max(0, $offset))->limit($limit + 1)
            ->get(array_merge(['c.*'], array_map(fn ($c) => 'p.'.$c, self::MINE)))->all();

        return [
            'conversations' => $this->summaries(array_slice($rows, 0, $limit), $viewer),
            'hasMore' => count($rows) > $limit,
        ];
    }

    /** @return array<string, mixed> */
    public function summary(object $conversation, User $viewer): array
    {
        $mine = $this->db->table('parley_participants')
            ->where('conversation_id', $conversation->id)->where('user_id', $viewer->id)
            ->first(self::MINE);

        $row = (object) array_merge((array) $conversation, array_fill_keys(self::MINE, null), (array) ($mine ?? []));

        return $this->summaries([$row], $viewer)[0];
    }

    /**
     * Several conversations' summaries for one viewer, in the order given,
     * in the same fixed number of queries as one.
     *
     * @param  int[]  $ids
     * @return list<array<string, mixed>>
     */
    public function summariesFor(array $ids, User $viewer): array
    {
        if ($ids === []) {
            return [];
        }

        $rows = $this->db->table('parley_conversations as c')
            ->leftJoin('parley_participants as p', fn ($j) => $j->on('p.conversation_id', '=', 'c.id')->where('p.user_id', '=', $viewer->id))
            ->whereIn('c.id', $ids)
            ->get(array_merge(['c.*'], array_map(fn ($c) => 'p.'.$c, self::MINE)))
            ->keyBy('id');

        return $this->summaries(array_values(array_filter(array_map(fn ($id) => $rows->get($id), $ids))), $viewer);
    }

    /**
     * @param  list<object>  $rows  conversation rows carrying the viewer's last_read_message_id
     * @return list<array<string, mixed>>
     */
    private function summaries(array $rows, User $viewer): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rows);

        // A room's members can number in the hundreds and are not drawn in its
        // header, so only direct conversations load theirs.
        $directIds = array_map(fn ($r) => (int) $r->id, array_filter($rows, fn ($r) => ! $this->rooms->isRoom($r)));
        $participants = $directIds === [] ? collect() : $this->db->table('parley_participants')->whereIn('conversation_id', $directIds)
            ->orderBy('id')->get(['conversation_id', 'user_id', 'last_read_message_id', 'role']);
        $byConversation = $participants->groupBy('conversation_id');

        // A group's summary carries its first few faces, not all fifty: the
        // list draws a stack of them, and the details column loads the rest.
        $userIds = [];
        foreach ($byConversation as $members) {
            $others = $members->where('user_id', '!=', $viewer->id);
            foreach ($others->take(self::GROUP_FACES) as $p) {
                $userIds[(int) $p->user_id] = true;
            }
        }
        $userIds = array_keys($userIds);
        $users = $this->people->users($userIds);

        $lastIds = array_values(array_filter(array_map(fn ($r) => (int) $r->last_message_id, $rows)));
        $lastMessages = $this->payloads->payloads(
            $this->db->table('parley_messages')->whereIn('id', $lastIds)->get()->all()
        );
        $lastById = [];
        foreach ($lastMessages as $m) {
            $lastById[$m['id']] = $m;
        }

        $unread = $this->unreadCounts($viewer->id, $ids, true);
        $online = $this->presence->shownOnlineAmong($userIds);
        $pinned = Counts::by($this->db->table('parley_pins')->whereIn('conversation_id', $ids), 'conversation_id');

        $out = [];
        foreach ($rows as $row) {
            $id = (int) $row->id;
            $isRoom = $this->rooms->isRoom($row);
            $isGroup = ! $isRoom && (bool) $row->is_group;
            $others = [];
            $seenBy = [];
            $memberCount = 0;
            $role = 'member';

            foreach ($byConversation->get($id, collect()) as $p) {
                $memberCount++;
                $uid = (int) $p->user_id;
                if ($uid === $viewer->id) {
                    $role = $p->role ?: 'member';
                    continue;
                }
                if ($user = $users->get($uid)) {
                    $others[] = $this->people->card($user) + ['online' => isset($online[$uid])];
                }
                $seenBy[$uid] = $p->last_read_message_id ? (int) $p->last_read_message_id : null;
            }

            $lastRead = $row->last_read_message_id ? (int) $row->last_read_message_id : null;

            $out[] = [
                'id' => $id,
                'type' => $isRoom ? 'room' : 'direct',
                'room' => $isRoom ? $this->rooms->card($row) : null,
                'isGroup' => $isGroup,
                'title' => $isRoom ? $row->title : ($row->title ?: null),
                'imageUrl' => $isGroup ? $this->photos->url($row->image_path ?? null) : null,
                'participants' => $others,
                'memberCount' => $isRoom ? null : $memberCount,
                'role' => $role,
                'lastMessage' => $lastById[(int) $row->last_message_id] ?? null,
                'lastMessageAt' => $row->last_message_at ? Carbon::parse($row->last_message_at)->toIso8601String() : null,
                'lastReadMessageId' => $lastRead,
                // Read receipts by person; a group's carries every member's.
                'seenBy' => $seenBy,
                'unread' => $unread[$id] ?? 0,
                'muted' => (bool) $row->muted,
                'archived' => ! empty($row->archived_at),
                'starred' => (bool) ($row->starred ?? false),
                'label' => $row->label ?? null,
                'request' => ! empty($row->requested_at),
                'mentioned' => ! empty($row->last_mention_id) && (int) $row->last_mention_id > (int) $lastRead,
                'pinCount' => (int) ($pinned[$id] ?? 0),
            ];
        }

        return $out;
    }

    /**
     * Unread messages per conversation for one person: messages from someone
     * else, newer than the last one they read.
     *
     * @param  int[]|null  $conversationIds  null for all of theirs
     * @return array<int, int>
     */
    public function unreadCounts(int $userId, ?array $conversationIds = null, bool $withRequests = false): array
    {
        $q = $this->db->table('parley_participants as p')
            ->join('parley_messages as m', 'm.conversation_id', '=', 'p.conversation_id')
            ->where('p.user_id', $userId)
            ->where(fn ($w) => $w->whereNull('m.user_id')->orWhere('m.user_id', '!=', $userId))
            ->whereNull('m.deleted_at')
            ->where(fn ($w) => $w->whereNull('p.last_read_message_id')->orWhereColumn('m.id', '>', 'p.last_read_message_id'));

        if ($conversationIds !== null) {
            $q->whereIn('p.conversation_id', $conversationIds);
        }

        // A message request is not news until it is accepted: it counts in
        // the Requests filter only, never on a badge.
        if (! $withRequests) {
            $q->whereNull('p.requested_at');
        }

        // 🚨 Grouped by the aliased column through the builder, never in raw
        // SQL: the alias `p` is prefixed like a table on a prefixed forum,
        // and only the builder applies that prefix.
        return Counts::by($q, 'p.conversation_id');
    }

    /**
     * Requests waiting for one person, and the conversations they have muted
     * or archived that have something unread — news that neither pops up
     * nor counts on the badge.
     *
     * @return array{requests: int, quiet: int[]}
     */
    public function inboxState(int $userId, array $unread): array
    {
        $requests = $this->db->table('parley_participants as p')
            ->join('parley_conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $userId)->whereNotNull('p.requested_at')->whereNotNull('c.last_message_id')
            ->where(fn ($q) => $q->whereNull('p.hidden_at')->orWhereColumn('c.last_message_at', '>', 'p.hidden_at'))
            ->count();

        $quiet = array_keys(array_filter($unread));
        $quiet = $quiet === [] ? [] : $this->db->table('parley_participants')->where('user_id', $userId)
            ->whereIn('conversation_id', $quiet)->where(fn ($q) => $q->where('muted', true)->orWhereNotNull('archived_at'))
            ->pluck('conversation_id')->map(fn ($id) => (int) $id)->all();

        return ['requests' => $requests, 'quiet' => $quiet];
    }
}
