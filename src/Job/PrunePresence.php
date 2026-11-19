<?php

namespace Ernestdefoe\Parley\Job;

use Ernestdefoe\Parley\PresenceStore;
use Flarum\Queue\AbstractJob;

/**
 * Drop presence rows nobody has refreshed for ten minutes. Housekeeping, not
 * correctness: every read already ignores rows past PresenceStore::WINDOW.
 * Queued from a heartbeat at most once per PresenceStore::PRUNE_EVERY, and run
 * by the parley:prune-presence schedule as well.
 */
class PrunePresence extends AbstractJob
{
    public function handle(PresenceStore $presence): void
    {
        $presence->prune();
    }
}
