<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\Paths;

/**
 * Parley's private disk (Images::DISK): what is sent in a conversation.
 *
 * Under storage/, outside the web root, with no public URL: every file is
 * served by ImageController after it checks the viewer may read the
 * conversation. A forum can point the disk at another driver with
 * `disk_driver.ernestdefoe-parley`, like core's own disks.
 */
class UploadsDisk
{
    /** @return array<string, mixed> */
    public function __invoke(Paths $paths): array
    {
        return ['root' => $paths->storage.'/parley'];
    }
}
