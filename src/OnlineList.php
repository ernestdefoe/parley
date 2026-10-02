<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * The rail: who is online, what they are doing, and the people you follow.
 *
 * Built in a fixed number of queries however many people are online, because it
 * is rebuilt on every heartbeat of every member.
 */
class OnlineList
{
    /** Past this many, the list says "and N more" instead of drawing them. */
    public const CAP = 150;

    public function __construct(
        protected PresenceStore $presence,
        protected Relations $relations,
        protected Gate $gate,
        protected People $people,
        protected SlugManager $slugs,
        protected Rooms $rooms
    ) {
    }

    /** @return array<string, mixed> */
    public function for(User $viewer): array
    {
        $rows = $this->presence->onlineMembers();
        $follows = $this->relations->followedBy($viewer->id);
        $blocked = $this->relations->blockedEitherWay($viewer->id);
        $canSeeHidden = $viewer->hasPermission(Gate::MODERATE);
        $canSeeLastSeen = $viewer->hasPermission('user.viewLastSeenAt');

        $rowsByUser = [];
        foreach ($rows as $row) {
            $rowsByUser[(int) $row->user_id] ??= $row;
        }

        $ids = array_unique(array_merge(array_keys($rowsByUser), array_keys($follows)));
        $users = $ids === []
            ? collect()
            : User::query()->whereIn('id', $ids)->with('groups')->get()->keyBy('id');

        $discussions = $this->discussions($viewer, $rowsByUser);
        $tags = $this->tags($viewer, $rowsByUser);
        $roomNames = $this->roomNames($viewer, $rowsByUser);

        $online = [];
        $followingOffline = [];
        $more = 0;

        foreach ($users as $id => $user) {
            $id = (int) $id;
            if ($id === $viewer->id || isset($blocked[$id]) || ! $this->gate->canUseInBulk($user)) {
                continue;
            }

            $row = $rowsByUser[$id] ?? null;
            $discloses = (bool) $user->getPreference('discloseOnline', true) || $canSeeLastSeen;
            $hidden = $row && ($row->status === 'invisible'
                || ! $discloses
                || (! $canSeeHidden && $this->gate->hiddenFromListInBulk($user)));

            if ($row && ! $hidden) {
                if (count($online) >= self::CAP) {
                    $more++;
                    continue;
                }

                $online[] = $this->people->card($user) + [
                    'status' => $row->status,
                    'activity' => $this->activity($row, $discussions, $tags, $roomNames),
                    'following' => isset($follows[$id]),
                ];
            } elseif (isset($follows[$id])) {
                // Battle.net keeps offline friends in the list, greyed. So do
                // we, for the people you follow — and only say when they were
                // last here if they let people see that.
                $followingOffline[] = $this->people->card($user) + [
                    'status' => 'offline',
                    'activity' => null,
                    'following' => true,
                    'lastSeenAt' => $discloses && $user->last_seen_at
                        ? Carbon::parse($user->last_seen_at)->toIso8601String()
                        : null,
                ];
            }
        }

        return [
            'online' => $online,
            'followingOffline' => $followingOffline,
            'more' => $more,
            'guests' => $this->presence->guestCount(),
        ];
    }

    /**
     * What a row is doing, as the viewer is allowed to know it.
     *
     * 🚨 A place the viewer cannot see is never named. "Reading · <title of a
     * staff-only discussion>" would disclose the discussion; the line falls back
     * to "Online" instead, which says nothing.
     *
     * @return array{verb: string, label: string|null, discussionId?: int, slug?: string, near?: int|null, tagSlug?: string, idleMinutes?: int}|null
     */
    private function activity(object $row, array $discussions, array $tags, array $roomNames = []): ?array
    {
        if ($row->status === 'away') {
            $minutes = $row->away_since ? max(1, (int) floor((time() - strtotime($row->away_since)) / 60)) : 1;

            return ['verb' => 'away', 'label' => null, 'idleMinutes' => $minutes];
        }

        if ($row->status === 'busy') {
            return ['verb' => 'busy', 'label' => null];
        }

        // In a room, by voice or by chat — named only if the viewer can see it.
        if (in_array($row->place, ['room', 'voice'], true) && $row->room_id && isset($roomNames[(int) $row->room_id])) {
            return [
                'verb' => $row->place === 'voice' ? 'in_voice' : 'chatting',
                'label' => $roomNames[(int) $row->room_id],
                'roomId' => (int) $row->room_id,
            ];
        }

        if (in_array($row->place, ['discussion', 'reply'], true) && $row->discussion_id && isset($discussions[(int) $row->discussion_id])) {
            $d = $discussions[(int) $row->discussion_id];

            return [
                'verb' => $row->place === 'reply' ? 'replying' : 'reading',
                'label' => $d['title'],
                'discussionId' => $d['id'],
                'slug' => $d['slug'],
                'near' => $row->near_number ? (int) $row->near_number : null,
            ];
        }

        if ($row->place === 'tag' && $row->tag_id && isset($tags[(int) $row->tag_id])) {
            return ['verb' => 'browsing', 'label' => $tags[(int) $row->tag_id]['name'], 'tagSlug' => $tags[(int) $row->tag_id]['slug']];
        }

        if ($row->place === 'index') {
            return ['verb' => 'browsing_all', 'label' => null];
        }

        return null;
    }

    /** @return array<int, array{id: int, title: string, slug: string}> */
    private function discussions(User $viewer, array $rowsByUser): array
    {
        $ids = [];
        foreach ($rowsByUser as $row) {
            if ($row->discussion_id) {
                $ids[(int) $row->discussion_id] = true;
            }
        }

        if ($ids === []) {
            return [];
        }

        $out = [];
        $slugger = $this->slugs->forResource(Discussion::class);
        foreach (Discussion::whereVisibleTo($viewer)->whereIn('discussions.id', array_keys($ids))->get() as $d) {
            $out[(int) $d->id] = ['id' => (int) $d->id, 'title' => $d->title, 'slug' => $slugger->toSlug($d)];
        }

        return $out;
    }

    /**
     * Names of the rooms people are in, for the rooms this viewer can see.
     * A staff room someone is chatting in is not named to a member who
     * cannot see it: their line falls back to "Online".
     *
     * @return array<int, string>
     */
    private function roomNames(User $viewer, array $rowsByUser): array
    {
        $ids = [];
        foreach ($rowsByUser as $row) {
            if (! empty($row->room_id)) {
                $ids[(int) $row->room_id] = true;
            }
        }

        if ($ids === []) {
            return [];
        }

        $out = [];
        foreach ($this->rooms->findMany(array_keys($ids)) as $room) {
            if ($this->rooms->canView($room, $viewer)) {
                $out[(int) $room->id] = (string) $room->name;
            }
        }

        return $out;
    }

    /** @return array<int, array{name: string, slug: string}> */
    private function tags(User $viewer, array $rowsByUser): array
    {
        if (! class_exists(\Flarum\Tags\Tag::class)) {
            return [];
        }

        $ids = [];
        foreach ($rowsByUser as $row) {
            if ($row->tag_id) {
                $ids[(int) $row->tag_id] = true;
            }
        }

        if ($ids === []) {
            return [];
        }

        $out = [];
        foreach (\Flarum\Tags\Tag::whereVisibleTo($viewer)->whereIn('tags.id', array_keys($ids))->get(['id', 'name', 'slug']) as $tag) {
            $out[(int) $tag->id] = ['name' => $tag->name, 'slug' => $tag->slug];
        }

        return $out;
    }
}
