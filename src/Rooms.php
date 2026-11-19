<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Ernestdefoe\Parley\Tags\TagVisibility;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Chat rooms: conversations anyone allowed in may read and join.
 *
 * 🚨 Who may see a room is decided by its tag. A room tied to a staff-only tag
 * is invisible — not merely locked — to everyone who cannot see that tag, and
 * that holds for the list, the messages, the online count and every push.
 */
class Rooms
{
    /**
     * @deprecated Register with RoomRegistry::addCardExtender(). Still read
     *             (RoomRegistry::cardExtenders()) for Parley Calls, which adds
     *             who is in each room's voice chat here.
     *
     * @var list<callable>
     */
    public static array $cardExtenders = [];

    /**
     * @deprecated Register with RoomRegistry::addOwner(). Still read
     *             (RoomRegistry::owner()) for extensions written before it.
     *
     * @var array<string, callable>
     */
    public static array $owners = [];

    /** How long a tag-bound room's audience is remembered, in seconds. */
    private const AUDIENCE_TTL = 60;

    /** @var array<int, array<int, true>> viewer id => visible tag ids */
    private array $visibleTags = [];

    /** @var array<int, array{icon: ?string, color: ?string}>|null tag id => its icon and colour */
    private ?array $tagLooks = null;

    public function __construct(
        protected ConnectionInterface $db,
        protected Gate $gate,
        protected PresenceStore $presence,
        protected TranslatorInterface $translator,
        protected RoomImages $images,
        protected TagVisibility $tags,
        protected RoomRegistry $registry,
        protected MessageFiles $files,
        protected Cache $cache
    ) {
    }

    public function isRoom(object $conversation): bool
    {
        return ($conversation->type ?? 'direct') === 'room';
    }

    public function isOwned(object $room): bool
    {
        return ! empty($room->owner);
    }

    public function canView(object $room, User $actor): bool
    {
        if (! $this->isRoom($room) || ! $this->gate->canUse($actor)) {
            return false;
        }

        // 🚨 A room another extension owns (RoomRegistry::addOwner()) is voice
        // only. It never appears in a list, it carries no text chat, and it is
        // invisible to everyone when its owner is not here to answer, so
        // disabling the owner closes it rather than opening it. Parley Calls'
        // voice chat reaches it through here like any room.
        if ($this->isOwned($room)) {
            $owner = $this->registry->owner((string) $room->owner);

            return $owner !== null && (bool) $owner($room, $actor);
        }

        if ($room->archived_at && ! $actor->isAdmin()) {
            return false;
        }

        return $room->tag_id === null || isset($this->tagsVisibleTo($actor)[(int) $room->tag_id]);
    }

    /** Whether $actor may read and write this room's text chat. Owned rooms have none. */
    public function canChat(object $room, User $actor): bool
    {
        return ! $this->isOwned($room) && $this->canView($room, $actor);
    }

    /** Why $actor may not post here, or null if they may. */
    public function postRefusal(object $room, User $actor): ?string
    {
        if (! $this->canView($room, $actor)) {
            return 'room_hidden';
        }
        if (! $actor->is_email_confirmed) {
            return 'unconfirmed';
        }
        if ($room->archived_at) {
            return 'room_archived';
        }
        if ($room->readonly && ! $actor->hasPermission(Gate::MODERATE)) {
            return 'room_readonly';
        }

        return null;
    }

    // ── Listing ─────────────────────────────────────────────────────────────

    /**
     * Every room this person can see, in the admin's order, with whether they
     * are in it, how many unread, and how many of its members are online now.
     * A fixed number of queries however many rooms there are.
     *
     * Which rooms: by default the top level (conferences) plus any child room
     * the viewer has joined — what the rail draws before anything is opened,
     * and what the heartbeat carries every 30 seconds. With $parentId, that
     * room's children, fetched when a conference is opened in the rail.
     *
     * @param  array<int, int>  $unread  conversation id => unread, from Conversations
     * @return list<array<string, mixed>>
     */
    public function listFor(User $viewer, array $unread, ?int $parentId = null): array
    {
        $all = array_values(array_filter(
            $this->db->table('parley_conversations')->where('type', 'room')->whereNull('archived_at')->whereNull('owner')
                ->orderBy('position')->orderBy('id')->get()->all(),
            fn ($room) => $this->canView($room, $viewer)
        ));

        if ($all === []) {
            return [];
        }

        $joined = array_fill_keys(
            $this->db->table('parley_participants')->whereIn('conversation_id', array_map(fn ($r) => (int) $r->id, $all))->where('user_id', $viewer->id)
                ->pluck('conversation_id')->map(fn ($id) => (int) $id)->all(),
            true
        );

        // Children per parent, among the rooms this viewer can see: the count
        // the rail shows on a conference, and the unread it rolls up.
        $childCount = [];
        $childUnread = [];
        foreach ($all as $room) {
            if ($room->parent_id) {
                $p = (int) $room->parent_id;
                $childCount[$p] = ($childCount[$p] ?? 0) + 1;
                if (isset($joined[(int) $room->id])) {
                    $childUnread[$p] = ($childUnread[$p] ?? 0) + ($unread[(int) $room->id] ?? 0);
                }
            }
        }

        $rooms = array_values(array_filter($all, fn ($room) => $parentId !== null
            ? (int) $room->parent_id === $parentId
            : ($room->parent_id === null || isset($joined[(int) $room->id]))));

        if ($rooms === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rooms);

        $members = Counts::by($this->db->table('parley_participants')->whereIn('conversation_id', $ids), 'conversation_id');

        // Members of each room who are online and not hiding, in one query.
        $cutoff = date('Y-m-d H:i:s', time() - PresenceStore::WINDOW);
        $online = Counts::by(
            $this->db->table('parley_participants as p')
                ->join('parley_presence as pr', 'pr.user_id', '=', 'p.user_id')
                ->whereIn('p.conversation_id', $ids)
                ->where('pr.last_seen_at', '>=', $cutoff)
                ->where('pr.status', '!=', 'invisible'),
            'p.conversation_id',
            'pr.user_id'
        );

        return $this->extend(array_map(fn ($room) => $this->card($room) + [
            'children' => $childCount[(int) $room->id] ?? 0,
            'childUnread' => $childUnread[(int) $room->id] ?? 0,
            'joined' => isset($joined[(int) $room->id]),
            'unread' => isset($joined[(int) $room->id]) ? ($unread[(int) $room->id] ?? 0) : 0,
            'members' => $members[(int) $room->id] ?? 0,
            'online' => $online[(int) $room->id] ?? 0,
        ], $rooms), $viewer);
    }

    /**
     * @param  list<array<string, mixed>>  $cards
     * @return list<array<string, mixed>>
     */
    public function extend(array $cards, ?User $viewer = null): array
    {
        foreach ($this->registry->cardExtenders() as $extender) {
            $cards = $extender($cards, $viewer);
        }

        return $cards;
    }

    /** @return array<string, mixed> */
    public function card(object $room): array
    {
        return [
            'id' => (int) $room->id,
            'name' => $room->name,
            'slug' => $room->slug,
            'description' => $room->description,
            'emoji' => $room->emoji,
            'imageUrl' => ! empty($room->image_path) ? $this->images->url($room->image_path) : null,
            'imageDarkUrl' => ! empty($room->image_dark_path) ? $this->images->url($room->image_dark_path) : null,
            'parentId' => ! empty($room->parent_id) ? (int) $room->parent_id : null,
            'tagId' => $room->tag_id ? (int) $room->tag_id : null,
            // The tag's own icon and colour, so a room with no emoji wears its
            // tag's badge — a conference room shows the conference logo.
            'tagIcon' => $room->tag_id ? ($this->tagLook((int) $room->tag_id)['icon'] ?? null) : null,
            'tagColor' => $room->tag_id ? ($this->tagLook((int) $room->tag_id)['color'] ?? null) : null,
            'readonly' => (bool) $room->readonly,
            'position' => (int) $room->position,
            'archived' => $room->archived_at !== null,
            'lastMessageAt' => $room->last_message_at ? Carbon::parse($room->last_message_at)->toIso8601String() : null,
        ];
    }

    // ── Membership ──────────────────────────────────────────────────────────

    public function join(object $room, User $actor): void
    {
        if (! $this->canChat($room, $actor)) {
            return;
        }

        $exists = $this->db->table('parley_participants')
            ->where('conversation_id', $room->id)->where('user_id', $actor->id)->exists();

        if (! $exists) {
            // Joining starts you at the latest message: a room's history is
            // there to scroll, not a pile of unread to wade through.
            $this->db->table('parley_participants')->insert([
                'conversation_id' => $room->id,
                'user_id' => $actor->id,
                'last_read_message_id' => $room->last_message_id,
                'joined_at' => date('Y-m-d H:i:s'),
            ]);
        }
    }

    public function leave(object $room, User $actor): void
    {
        $this->db->table('parley_participants')
            ->where('conversation_id', $room->id)->where('user_id', $actor->id)->delete();
    }

    /**
     * Members to push a room event to: only the ones who can still see it, so
     * a room moved under a staff tag stops reaching members who lost access.
     *
     * Runs on every send, edit, reaction, pin and typing signal, so it is a
     * fixed handful of queries however many members there are (members with
     * their groups, the tag, who holds its permissions: TagVisibility::
     * whoCanSee()), remembered for a minute per room, tag and member list.
     * Moving the room to another tag or a member joining or leaving changes
     * the key and takes effect at once; a change to a group's permissions
     * reaches pushes within the minute.
     *
     * @param  int[]  $memberIds
     * @return int[]
     */
    public function audience(object $room, array $memberIds): array
    {
        if ($room->tag_id === null || $memberIds === []) {
            return $memberIds;
        }

        $ids = array_values(array_unique(array_map('intval', $memberIds)));
        sort($ids);
        $key = 'parley.audience.'.(int) $room->id.'.'.(int) $room->tag_id.'.'.md5(implode(',', $ids));

        return $this->cache->remember($key, self::AUDIENCE_TTL, fn () => $this->tags->whoCanSee(
            (int) $room->tag_id,
            User::query()->whereIn('id', $ids)->with('groups')->orderBy('id')->get()->all()
        ));
    }

    // ── Administration ──────────────────────────────────────────────────────

    /** @param  array<string, mixed>  $data */
    public function save(?object $room, array $data): object
    {
        $name = trim((string) ($data['name'] ?? ($room->name ?? '')));
        if ($name === '' || mb_strlen($name) > 80) {
            throw new ValidationException(['name' => $this->translator->trans('ernestdefoe-parley.api.room_name')]);
        }

        $tagId = isset($data['tagId']) && $data['tagId'] !== '' ? (int) $data['tagId'] : null;
        if (array_key_exists('tagId', $data) === false && $room) {
            $tagId = $room->tag_id;
        }

        $values = [
            'name' => $name,
            'description' => mb_substr(trim((string) ($data['description'] ?? ($room->description ?? ''))), 0, 300) ?: null,
            'emoji' => mb_substr(trim((string) ($data['emoji'] ?? ($room->emoji ?? ''))), 0, 8) ?: null,
            'tag_id' => $tagId,
            'readonly' => (bool) ($data['readonly'] ?? ($room->readonly ?? false)),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if (array_key_exists('parentId', $data)) {
            $parent = $data['parentId'] ? $this->find((int) $data['parentId']) : null;
            // One level only: a team under a conference, never deeper, and
            // never under itself.
            $values['parent_id'] = $parent && ! $parent->parent_id && (! $room || (int) $parent->id !== (int) $room->id)
                ? (int) $parent->id
                : null;
        }

        if (array_key_exists('archived', $data)) {
            $values['archived_at'] = $data['archived'] ? ($room->archived_at ?? date('Y-m-d H:i:s')) : null;
        }

        if ($room) {
            $this->db->table('parley_conversations')->where('id', $room->id)->update($values);

            return $this->db->table('parley_conversations')->find($room->id);
        }

        $id = $this->db->table('parley_conversations')->insertGetId($values + [
            'type' => 'room',
            'is_group' => true,
            'slug' => $this->uniqueSlug($name),
            'position' => (int) $this->db->table('parley_conversations')->where('type', 'room')->max('position') + 1,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->db->table('parley_conversations')->find($id);
    }

    /** @param  int[]  $ids  in their new order */
    public function reorder(array $ids): void
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return;
        }

        // One UPDATE with a CASE, not one per room. Every id and position is
        // an int (intval above, array keys), so they are written in as numbers.
        $case = 'case '.$this->db->getQueryGrammar()->wrap('id');
        foreach ($ids as $i => $id) {
            $case .= " when $id then $i";
        }

        $this->db->table('parley_conversations')->where('type', 'room')->whereIn('id', $ids)
            ->update(['position' => $this->db->raw($case.' end')]);
    }

    public function destroy(object $room): void
    {
        // Before the rows go (deleting the room cascades its messages away):
        // its messages' files, less any a message elsewhere still shows.
        $this->files->forgetConversation((int) $room->id);

        $this->images->remove($room);
        // Its teams move up a level rather than disappearing with it.
        $this->db->table('parley_conversations')->where('parent_id', $room->id)->update(['parent_id' => null]);
        $this->db->table('parley_conversations')->where('id', $room->id)->where('type', 'room')->delete();
    }

    /** @return list<array<string, mixed>> every room, archived too, for the admin page */
    public function all(): array
    {
        $rooms = $this->db->table('parley_conversations')->where('type', 'room')->whereNull('owner')
            ->orderBy('position')->orderBy('id')->get();

        // One grouped count: FBSFB alone has 147 rooms.
        $members = Counts::by($this->db->table('parley_participants')->whereIn('conversation_id', $rooms->pluck('id')), 'conversation_id');

        return $this->extend($rooms->map(fn ($r) => $this->card($r) + [
            'members' => $members[(int) $r->id] ?? 0,
        ])->values()->all());
    }

    /** @return list<object> rooms with these ids, in one query */
    public function findMany(array $ids): array
    {
        return $ids === [] ? [] : $this->db->table('parley_conversations')->where('type', 'room')->whereIn('id', $ids)->get()->all();
    }

    public function find(int $id): ?object
    {
        $room = $this->db->table('parley_conversations')->find($id);

        return $room && $this->isRoom($room) ? $room : null;
    }

    // ── Internals ───────────────────────────────────────────────────────────

    /** @return array<int, true> */
    private function tagsVisibleTo(User $user): array
    {
        return $this->visibleTags[(int) $user->id] ??= array_fill_keys($this->tags->visibleIds($user), true);
    }

    /**
     * Every tag's icon and colour, read once per request: the tags table is
     * small, and one query beats one per room.
     *
     * @return array{icon: ?string, color: ?string}
     */
    private function tagLook(int $tagId): array
    {
        $this->tagLooks ??= $this->tags->looks();

        return $this->tagLooks[$tagId] ?? ['icon' => null, 'color' => null];
    }

    /** A slug for a new room from its name, -2, -3… when it is taken. */
    public function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'room';
        $slug = $base;
        for ($i = 2; $this->db->table('parley_conversations')->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }
}
