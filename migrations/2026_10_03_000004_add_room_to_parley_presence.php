<?php

use Flarum\Database\Migration;

return Migration::addColumns('parley_presence', [
    // The room someone is chatting or talking in, when that is what they
    // are doing. Shown only to people who can see the room.
    'room_id' => ['integer', 'unsigned' => true, 'nullable' => true],
]);
