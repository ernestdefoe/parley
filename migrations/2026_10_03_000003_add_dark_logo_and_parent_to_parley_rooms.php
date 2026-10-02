<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * A room's logo for dark mode, and the room it sits under: a team's room under
 * its conference's.
 */
return [
    'up' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->string('image_dark_path', 150)->nullable()->after('image_path');
            $table->unsignedInteger('parent_id')->nullable()->after('tag_id');
            $table->index('parent_id');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->dropIndex(['parent_id']);
            $table->dropColumn(['image_dark_path', 'parent_id']);
        });
    },
];
