<?php

namespace Ernestdefoe\Parley\Job;

use Ernestdefoe\Parley\Realtime\Channel;
use Flarum\Queue\AbstractJob;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * One Broadcaster push, sent from the queue so the HTTP calls to the
 * websocket daemon (one per 100 recipients) never hold up the request that
 * caused them. With the sync queue (Flarum's default) it runs at once, as
 * before.
 *
 * 🚨 What it pushes about is already saved. A daemon that is down must not
 * turn that into an error, nor into a job retried for nothing: the failure
 * is logged and the client reconciles on its next fetch.
 */
class PushRealtime extends AbstractJob
{
    /**
     * @param  list<list<string>|string>  $batches  channels, one trigger per batch
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public array $batches,
        public string $event,
        public array $payload
    ) {
    }

    public function handle(Channel $channel, LoggerInterface $log): void
    {
        try {
            foreach ($this->batches as $channels) {
                $channel->trigger($channels, $this->event, $this->payload);
            }
        } catch (Throwable $e) {
            $log->warning('[parley] realtime push failed: '.$e->getMessage());
        }
    }
}
