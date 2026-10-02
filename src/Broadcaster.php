<?php

namespace Ernestdefoe\Parley;

use Illuminate\Contracts\Container\Container;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Pushes Parley events onto each recipient's private user channel.
 *
 * flarum/realtime only authorises its own private channels, so an extension
 * cannot open a channel per conversation. Every event therefore goes to
 * `private-user=<id>`, the one channel every signed-in browser already holds.
 *
 * With no realtime installed this does nothing, and the client polls.
 */
class Broadcaster
{
    public function __construct(
        protected Container $container,
        protected LoggerInterface $log
    ) {
    }

    public function available(): bool
    {
        return class_exists(\Pusher\Pusher::class) && $this->container->bound(\Pusher\Pusher::class);
    }

    /**
     * A signal on realtime's public channel, carrying nothing but its name.
     * Used to say "the online list changed": every browser then asks for its
     * own list, so nobody learns from the signal who came or went — Appear
     * offline, blocks and hidden groups are all applied by that request.
     */
    public function toEveryone(string $event): void
    {
        if (! $this->available()) {
            return;
        }

        try {
            $this->container->make(\Pusher\Pusher::class)->trigger('public', 'parley.'.$event, ['at' => time()]);
        } catch (Throwable $e) {
            $this->log->warning('[parley] realtime push failed: '.$e->getMessage());
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

        // The message is already saved. A daemon that is down must not turn a
        // send into an error; the client reconciles on its next fetch.
        try {
            /** @var \Pusher\Pusher $pusher */
            $pusher = $this->container->make(\Pusher\Pusher::class);

            foreach (array_chunk($userIds, 100) as $chunk) {
                $pusher->trigger(
                    array_map(fn (int $id) => 'private-user='.$id, $chunk),
                    'parley.'.$event,
                    $payload
                );
            }
        } catch (Throwable $e) {
            $this->log->warning('[parley] realtime push failed: '.$e->getMessage());
        }
    }
}
