<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Broadcaster;
use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Groups;
use Ernestdefoe\Parley\Images;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Everything the client needs before its first heartbeat, in the boot
 * payload, so the rail draws on first paint instead of after a round trip.
 * The defaults are registered once, in extend.php's Extend\Settings; the
 * limits come from the classes that enforce them, clamped the same way.
 */
class ForumResourceFields
{
    public function __construct(
        protected Gate $gate,
        protected Broadcaster $broadcaster,
        protected SettingsRepositoryInterface $settings,
        protected Images $images,
        protected Groups $groups
    ) {
    }

    /** @return list<Schema\Arr> */
    public function __invoke(): array
    {
        return [
            Schema\Arr::make('parley')
                ->get(fn ($forum, Context $context) => $this->config($context)),
        ];
    }

    /** @return array<string, mixed> */
    private function config(Context $context): array
    {
        $actor = $context->getActor();

        return [
            'canUse' => $this->gate->canUse($actor),
            'canModerate' => ! $actor->isGuest() && $actor->hasPermission(Gate::MODERATE),
            'realtime' => $this->broadcaster->available(),
            'awayMinutes' => max(1, (int) $this->settings->get('ernestdefoe-parley.away_minutes')),
            'maxImageMb' => $this->images->maxMb('image'),
            'maxFileMb' => $this->images->maxMb('file'),
            'maxVoiceSeconds' => $this->images->maxVoiceSeconds(),
            'groupMaxMembers' => $this->groups->maxMembers(),
            'reactions' => Conversations::REACTIONS,
            'labels' => Conversations::LABELS,
        ];
    }
}
