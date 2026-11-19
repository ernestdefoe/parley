<?php

namespace Ernestdefoe\Parley;

use Ernestdefoe\Parley\Job\PushRealtime;
use Ernestdefoe\Parley\Realtime\Channel;
use Illuminate\Contracts\Queue\Queue;

/**
 * Pushes Parley events onto each recipient's private user channel.
 *
 * flarum/realtime only authorises its own private channels, so an extension
 * cannot open a channel per conversation. Every event therefore goes to
 * `private-user=<id>`, the one channel every signed-in browser already holds.
 *
 * Where the pushes go is the Realtime\Channel binding: nowhere (NoChannel,
 * and the client polls) unless flarum/realtime is enabled. They are sent from
 * the queue (Job\PushRealtime), never inside the request.
 *
 * Parley Calls type-hints this class and its tests extend it: keep the class
 * name and the three public methods.
 */
class Broadcaster
{
    public function __construct(
        protected Channel $channel,
        protected Queue $queue
    ) {
    }

    public function available(): bool
    {
        return $this->channel->available();
    }

    /**
     * A signal on realtime's public channel, carrying nothing but its name.
     * Used to say "the online list changed": every browser then asks for its
     * own list, so nobody learns from the signal who came or went — Appear
     * offline, blocks and hidden groups are all applied by that request.
     */
    public function toEveryone(string $event): void
    {
        if ($this->available()) {
            $this->queue->push(new PushRealtime(['public'], 'parley.'.$event, ['at' => time()]));
        }
    }

    /**
     * @param  int[]  $userIds
     * @param  array<string, mixed>  $payload
     */
    public function toUsers(array $userIds, string $event, array $payload): void
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));

        if ($userIds === [] || ! $this->available()) {
            return;
        }

        // Pusher takes at most 100 channels per trigger.
        $batches = array_map(
            fn (array $chunk) => array_map(fn (int $id) => 'private-user='.$id, $chunk),
            array_chunk($userIds, 100)
        );

        $this->queue->push(new PushRealtime($batches, 'parley.'.$event, $payload));
    }
}
