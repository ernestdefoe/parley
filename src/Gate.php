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

        return match ($target->getPreference('parleyWhoCanMessage', 'everyone')) {
            'nobody' => 'closed',
            'following' => $this->relations->follows($target->id, $actor->id) ? null : 'following_only',
            default => null,
        };
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
