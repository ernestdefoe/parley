<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * The extension that owns a room, when one does: a voice-only room it creates
 * and decides access to, kept out of Parley's lists. See Rooms::$owners.
 */
return [
    'up' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->string('owner', 64)->nullable()->after('parent_id');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->dropColumn('owner');
        });
    },
];
