<?php

use Ernestdefoe\Parley\MessageLinks;
use Flarum\Database\Migration;
use Illuminate\Database\Schema\Builder;

/*
 * has_link marks a message whose text carries a web address (see
 * MessageLinks). Set as messages are sent; existing messages are marked here.
 */
$column = Migration::addColumns('parley_messages', [
    'has_link' => ['boolean', 'default' => false],
]);

return [
    'up' => function (Builder $schema) use ($column) {
        $column['up']($schema);

        MessageLinks::backfill($schema->getConnection());
    },
    'down' => $column['down'],
];
