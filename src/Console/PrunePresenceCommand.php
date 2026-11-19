<?php

namespace Ernestdefoe\Parley\Console;

use Ernestdefoe\Parley\PresenceStore;
use Flarum\Console\AbstractCommand;

/** Scheduled every ten minutes: see Job\PrunePresence. */
class PrunePresenceCommand extends AbstractCommand
{
    public function __construct(
        protected PresenceStore $presence
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('parley:prune-presence')
            ->setDescription('Remove presence rows of visitors who left more than ten minutes ago.');
    }

    protected function fire(): int
    {
        $this->info('Removed '.$this->presence->prune().' stale presence rows.');

        return 0;
    }
}
