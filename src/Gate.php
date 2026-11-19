<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Who may chat, and who may chat with whom.
 *
 * Permission checks for a LIST of people are done from the group_permission
 * table in bulk. `$user->hasPermission()` loads each user's permissions with
 * its own query, and the online list would then be one query per person on
 * every heartbeat — the shape of the outage where 34 requests on one page used
 * up a shared host's connections.
 */
class Gate
{
    public const USE = 'ernestdefoe-parley.use';

    public const MODERATE = 'ernestdefoe-parley.moderate';

    public const HIDDEN = 'ernestdefoe-parley.hideFromList';

    /** @var array<string, array<int, true>> */
    private array $groupsWith = [];

    public function __construct(
        protected ConnectionInterface $db,
        protected Relations $relations
    ) {
    }

    public function canUse(User $user): bool
    {
        if ($user->isGuest() || $this->isSuspended($user)) {
            return false;
        }

        return $user->hasPermission(self::USE);
    }

    /**
     * The same answer as canUse(), for a user whose groups are already loaded,
     * without a query of its own.
     */
    public function canUseInBulk(User $user): bool
    {
        return ! $this->isSuspended($user) && $this->groupsGrant($user, self::USE);
    }

    public function hiddenFromListInBulk(User $user): bool
    {
        // An administrator holds every permission, including this one, and
        // hiding every admin from the list by default is not what anyone meant.
        return ! $user->isAdmin() && $this->groupsGrant($user, self::HIDDEN, false);
    }

    /**
     * Why $actor may not message $target, or null if they may.
     * The reason is a translation key suffix the client shows as it is.
     */
    public function refusal(User $actor, User $target): ?string
    {
        if ($actor->id === $target->id) {
            return 'self';
        }

        if (! $this->canUse($actor)) {
            return 'no_permission';
        }

        if (! $actor->is_email_confirmed) {
            return 'unconfirmed';
        }

        if (! $this->canUse($target)) {
            return 'unavailable';
        }

        if ($this->relations->isBlockedEitherWay($actor->id, $target->id)) {
            return 'blocked';
        }

        // Staff can always reach a member; a "nobody" setting is about other
        // members, not about the people who run the forum.
        if ($actor->hasPermission(self::MODERATE)) {
            return null;
        }

        return $this->byPreference($target, fn () => $this->relations->follows($target->id, $actor->id));
    }

    /**
     * refusal() for many targets at once, in a fixed number of queries: the
     * targets' groups must be loaded.
     *
     * @param  iterable<User>  $targets
     * @return array<int, string> target id => reason, for the refused only
     */
    public function refusals(User $actor, iterable $targets): array
    {
        $targets = collect($targets);
        $ids = $targets->map(fn (User $u) => (int) $u->id)->all();
        $refused = [];

        $actorReason = ! $this->canUse($actor) ? 'no_permission' : (! $actor->is_email_confirmed ? 'unconfirmed' : null);
        $staff = $actorReason === null && $actor->hasPermission(self::MODERATE);
        $blocked = $actorReason === null ? $this->relations->blockedEitherWay($actor->id) : [];
        $followers = $actorReason === null && ! $staff ? $this->relations->followersAmong($actor->id, $ids) : [];

        foreach ($targets as $target) {
            $id = (int) $target->id;
            $reason = match (true) {
                $id === $actor->id => 'self',
                $actorReason !== null => $actorReason,
                $target->isGuest() || ! $this->canUseInBulk($target) => 'unavailable',
                isset($blocked[$id]) => 'blocked',
                $staff => null,
                default => $this->byPreference($target, fn () => isset($followers[$id])),
            };

            if ($reason !== null) {
                $refused[$id] = $reason;
            }
        }

        return $refused;
    }

    /** @param  callable(): bool  $followsActor */
    private function byPreference(User $target, callable $followsActor): ?string
    {
        return match ($target->getPreference('parleyWhoCanMessage')) {
            'nobody' => 'closed',
            'following' => $followsActor() ? null : 'following_only',
            default => null,
        };
    }

    /**
     * Whether a first message from $actor waits in $target's Requests: quietly,
     * with no alert and no pop-up, until $target accepts it or replies.
     *
     * It is the default "Everyone" setting doing it — everyone may write, and
     * the ones $target does not follow knock first. "Everyone, straight to my
     * inbox" turns it off; "People I follow" never lets a stranger through to
     * knock at all. Staff are never held back, the same as in refusal().
     */
    public function landsInRequests(User $actor, User $target): bool
    {
        if ($actor->hasPermission(self::MODERATE)) {
            return false;
        }

        return $target->getPreference('parleyWhoCanMessage') === 'everyone'
            && ! $this->relations->follows($target->id, $actor->id);
    }

    /**
     * landsInRequests() for many targets at once, in one query.
     *
     * @param  list<User>  $targets
     * @return array<int, true> the ones whose copy waits in their Requests
     */
    public function requestsAmong(User $actor, array $targets): array
    {
        if ($targets === [] || $actor->hasPermission(self::MODERATE)) {
            return [];
        }

        $followers = $this->relations->followersAmong($actor->id, array_map(fn (User $u) => (int) $u->id, $targets));
        $out = [];
        foreach ($targets as $target) {
            if ($target->getPreference('parleyWhoCanMessage') === 'everyone' && ! isset($followers[(int) $target->id])) {
                $out[(int) $target->id] = true;
            }
        }

        return $out;
    }

    public function isSuspended(User $user): bool
    {
        $until = $user->getAttribute('suspended_until');

        return $until !== null && Carbon::parse($until)->isFuture();
    }

    private function groupsGrant(User $user, string $permission, bool $memberCounts = true): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        $granted = $this->groupsWith[$permission] ??= array_fill_keys(
            $this->db->table('group_permission')->where('permission', $permission)
                ->pluck('group_id')->map(fn ($id) => (int) $id)->all(),
            true
        );

        // Core gives every confirmed account the Members group implicitly; it is
        // never a row in group_user.
        if ($memberCounts && $user->is_email_confirmed && isset($granted[Group::MEMBER_ID])) {
            return true;
        }

        foreach ($user->groups as $group) {
            if (isset($granted[(int) $group->id])) {
                return true;
            }
        }

        return false;
    }
}
