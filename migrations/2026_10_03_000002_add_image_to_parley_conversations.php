<?php

use Flarum\Database\Migration;

return Migration::addColumns('parley_conversations', [
    // A room's own logo, stored in the forum's assets: path relative to them.
    'image_path' => ['string', 'length' => 150, 'nullable' => true],
]);
