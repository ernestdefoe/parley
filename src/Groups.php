<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Group conversations: three or more people, with a name and a photo.
 *
 * A group is a direct conversation with `is_group` set, so everything that
 * reads or writes a conversation works on it unchanged. Membership is the
 * participants table; its creator is the `owner`, who alone removes others.
 * Anyone in it may rename it, change its photo, add people, or leave.
 *
 * 🚨 Adding someone is messaging them, so every person added is checked the
 * way a first message is: blocks either way, "Nobody", "People I follow" —
 * and, under "Everyone", a stranger's group waits in their Requests.
 */
class Groups
{
    public const NAME_MAX = 80;

    public function __construct(
        protected ConnectionInterface $db,
        protected Conversations $conversations,
        protected Gate $gate,
        protected People $people,
        protected PresenceStore $presence,
        protected GroupPhotos $photos,
        protected Broadcaster $broadcaster,
        protected SettingsRepositoryInterface $settings,
        protected TranslatorInterface $translator,
        protected Cache $cache
    ) {
    }

    public function maxMembers(): int
    {
        return max(3, min(250, (int) ($this->settings->get('ernestdefoe-parley.group_max_members') ?: 50)));
    }

    /** @param  int[]  $userIds  everyone but the creator */
    public function create(User $actor, array $userIds, ?string $name): object
    {
        if (! $this->gate->canUse($actor)) {
            throw new PermissionDeniedException();
        }
        if (! $actor->is_email_confirmed) {
            $this->fail('user', 'refusal.unconfirmed');
        }

        $name = $this->cleanName($name);
        $others = $this->people($actor, $userIds);

        if (count($others) < 2) {
            $this->fail('userIds', 'group_too_small');
        }
        if (count($others) + 1 > $this->maxMembers()) {
            $this->fail('userIds', 'group_too_big', ['max' => $this->maxMembers()]);
        }

        $this->refuseBlocked([$actor->id, ...array_map(fn (User $u) => (int) $u->id, $others)], $others);

        // Ten new groups an hour is plenty for a person; a script makes more.
        $key = 'parley.groups.'.$actor->id;
        $made = (int) $this->cache->get($key, 0);
        if ($made >= 10) {
            $this->fail('userIds', 'group_flood');
        }
        $this->cache->put($key, $made + 1, 3600);

        $now = date('Y-m-d H:i:s');
        $id = $this->db->transaction(function () use ($actor, $others, $name, $now) {
            $id = $this->db->table('parley_conversations')->insertGetId([
                'type' => 'direct',
                'is_group' => true,
                'title' => $name,
                'creator_id' => $actor->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->db->table('parley_participants')->insert([
                'conversation_id' => $id, 'user_id' => $actor->id, 'joined_at' => $now, 'role' => 'owner',
            ]);
            $this->insertMembers($id, $actor, $others, $now, null);

            return $id;
        });

        $conversation = $this->conversations->find($id, $actor);
        $this->conversations->send($conversation, $actor, 'system', null, [
            'action' => 'created',
            'name' => $name,
        ]);

        return $this->conversations->find($id, $actor);
    }

    public function rename(object $group, User $actor, ?string $name): void
    {
        $this->member($group, $actor);
        $name = $this->cleanName($name);

        $this->db->table('parley_conversations')->where('id', $group->id)->update(['title' => $name]);
        $this->conversations->send($group, $actor, 'system', null, ['action' => 'renamed', 'name' => $name]);
    }

    public function setPhoto(object $group, User $actor, ?UploadedFileInterface $upload): void
    {
        $this->member($group, $actor);

        $path = $upload ? $this->photos->store($upload, $group->image_path) : null;
        if (! $upload) {
            $this->photos->remove($group->image_path);
        }

        $this->db->table('parley_conversations')->where('id', $group->id)->update(['image_path' => $path]);
        $this->conversations->send($group, $actor, 'system', null, ['action' => $path ? 'photo' : 'photo_removed']);
    }

    /** @param  int[]  $userIds */
    public function add(object $group, User $actor, array $userIds): void
    {
        $this->member($group, $actor);

        $already = $this->conversations->participantIds((int) $group->id);
        $new = $this->people($actor, array_diff(array_map('intval', $userIds), $already));

        if ($new === []) {
            return;
        }
        if (count($already) + count($new) > $this->maxMembers()) {
            $this->fail('userIds', 'group_too_big', ['max' => $this->maxMembers()]);
        }

        $this->refuseBlocked([...$already, ...array_map(fn (User $u) => (int) $u->id, $new)], $new);

        $this->insertMembers((int) $group->id, $actor, $new, date('Y-m-d H:i:s'), $group->last_message_id ? (int) $group->last_message_id : null);

        $this->conversations->send($group, $actor, 'system', null, [
            'action' => 'added',
            'userIds' => array_map(fn (User $u) => (int) $u->id, $new),
            'names' => array_map(fn (User $u) => $u->display_name, $new),
        ]);
    }

    /** Remove someone, or leave when it is yourself. */
    public function remove(object $group, User $actor, int $userId): void
    {
        $this->member($group, $actor);
        $leaving = $userId === $actor->id;

        $row = $this->db->table('parley_participants')->where('conversation_id', $group->id)->where('user_id', $userId)->first();
        if (! $row) {
            throw new ModelNotFoundException();
        }

        if (! $leaving && ! $this->isOwner($group, $actor)) {
            throw new PermissionDeniedException();
        }

        $user = User::find($userId);
        // Said while they are still in it, so they hear it too, then gone.
        $this->conversations->send($group, $actor, 'system', null, [
            'action' => $leaving ? 'left' : 'removed',
            'userIds' => [$userId],
            'names' => [$user ? $user->display_name : ''],
        ]);

        $this->db->table('parley_participants')->where('id', $row->id)->delete();
        $this->broadcaster->toUsers([$userId], 'removed', ['conversationId' => (int) $group->id]);

        $left = $this->db->table('parley_participants')->where('conversation_id', $group->id)->orderBy('id');

        // The last one out leaves nothing behind.
        if (! $left->exists()) {
            $this->photos->remove($group->image_path);
            $this->db->table('parley_conversations')->where('id', $group->id)->delete();

            return;
        }

        // An owner who leaves hands the group to whoever has been in it longest.
        if ($row->role === 'owner' && ! (clone $left)->where('role', 'owner')->exists()) {
            $this->db->table('parley_participants')->where('id', (clone $left)->value('id'))->update(['role' => 'owner']);
        }
    }

    /**
     * Everyone in a group, owner first, as cards.
     *
     * @return list<array<string, mixed>>
     */
    public function members(object $group): array
    {
        $rows = $this->db->table('parley_participants')->where('conversation_id', $group->id)
            ->orderByRaw($this->db->getQueryGrammar()->wrap('role').' = ? desc', ['owner'])->orderBy('id')
            ->get(['user_id', 'role']);

        $users = $this->people->users($rows->pluck('user_id')->all());
        $online = $this->presence->shownOnlineAmong($users->keys()->map(fn ($id) => (int) $id)->all());

        return $rows->filter(fn ($r) => $users->has($r->user_id))->map(fn ($r) => $this->people->card($users->get($r->user_id)) + [
            'role' => $r->role,
            'online' => isset($online[(int) $r->user_id]),
        ])->values()->all();
    }

    public function isOwner(object $group, User $actor): bool
    {
        return $this->db->table('parley_participants')->where('conversation_id', $group->id)
            ->where('user_id', $actor->id)->where('role', 'owner')->exists();
    }

    // ── Internals ───────────────────────────────────────────────────────────

    /** @param  list<User>  $users */
    private function insertMembers(int $conversationId, User $actor, array $users, string $now, ?int $readUpTo): void
    {
        $this->db->table('parley_participants')->insert(array_map(fn (User $u) => [
            'conversation_id' => $conversationId,
            'user_id' => $u->id,
            'joined_at' => $now,
            'role' => 'member',
            // History is there to scroll, not a pile of unread.
            'last_read_message_id' => $readUpTo,
            'requested_at' => $this->gate->landsInRequests($actor, $u) ? $now : null,
        ], $users));
    }

    /**
     * The people to put in a group: real, visible to the actor, and each one
     * someone the actor may message. One refusal stops the whole change and
     * says who.
     *
     * @param  int[]  $userIds
     * @return list<User>
     */
    private function people(User $actor, array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds), fn ($id) => $id > 0 && $id !== $actor->id)));
        if ($ids === []) {
            return [];
        }
        if (count($ids) > $this->maxMembers()) {
            $this->fail('userIds', 'group_too_big', ['max' => $this->maxMembers()]);
        }

        $users = User::query()->whereVisibleTo($actor)->whereIn('id', $ids)->get();
        if ($users->count() !== count($ids)) {
            throw new ModelNotFoundException();
        }

        foreach ($users as $user) {
            if ($reason = $this->gate->refusal($actor, $user)) {
                throw new ValidationException(['userIds' => $this->translator->trans('ernestdefoe-parley.api.refusal.'.$reason, ['name' => $user->display_name])]);
            }
        }

        return $users->all();
    }

    /**
     * Nobody is put in a group with someone they have blocked, or who has
     * blocked them — whoever does the adding.
     *
     * @param  int[]  $everyone  the whole group as it would be
     * @param  list<User>  $joining  the people being put in it
     */
    private function refuseBlocked(array $everyone, array $joining): void
    {
        $joiningIds = array_map(fn (User $u) => (int) $u->id, $joining);

        $pair = $this->db->table('parley_blocks')
            ->where(fn ($q) => $q->whereIn('user_id', $joiningIds)->whereIn('blocked_id', $everyone))
            ->orWhere(fn ($q) => $q->whereIn('blocked_id', $joiningIds)->whereIn('user_id', $everyone))
            ->first();

        if ($pair) {
            $who = collect($joining)->first(fn (User $u) => in_array((int) $u->id, [(int) $pair->user_id, (int) $pair->blocked_id], true));
            throw new ValidationException(['userIds' => $this->translator->trans('ernestdefoe-parley.api.refusal.blocked_in_group', ['name' => $who ? $who->display_name : ''])]);
        }
    }

    private function member(object $group, User $actor): void
    {
        if (empty($group->is_group) || ($group->type ?? 'direct') !== 'direct' || ! $this->conversations->isParticipant((int) $group->id, $actor->id)) {
            throw new ModelNotFoundException();
        }
        if (! $this->gate->canUse($actor)) {
            throw new PermissionDeniedException();
        }
    }

    private function cleanName(?string $name): ?string
    {
        $name = trim(preg_replace('/\s+/u', ' ', (string) $name) ?? '');
        if (mb_strlen($name) > self::NAME_MAX) {
            $this->fail('name', 'group_name', ['max' => self::NAME_MAX]);
        }

        return $name === '' ? null : $name;
    }

    /** @return never */
    private function fail(string $field, string $key, array $params = []): void
    {
        throw new ValidationException([$field => $this->translator->trans('ernestdefoe-parley.api.'.$key, $params)]);
    }
}
