<?php

use Flarum\Database\Migration;
use Flarum\Group\Group;

return Migration::addPermissions([
    'ernestdefoe-parley.use' => Group::MEMBER_ID,
    'ernestdefoe-parley.moderate' => Group::MODERATOR_ID,
]);
