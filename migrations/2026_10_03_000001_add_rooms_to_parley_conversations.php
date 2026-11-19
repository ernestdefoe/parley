<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Rooms are conversations too: the same messages, reactions, pictures and
 * read state, so nothing written for one-to-one chat has to be written twice.
 * A room adds a name, a place in the list, and who may see it.
 */
return [
    'up' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            // direct | room
            $table->string('type', 8)->default('direct');
            $table->string('name', 80)->nullable();
            $table->string('slug', 100)->nullable()->unique();
            $table->string('description', 300)->nullable();
            $table->string('emoji', 16)->nullable();
            // A room tied to a tag is seen by exactly the people who can see
            // the tag. No tag: everyone who can use Parley.
            $table->unsignedInteger('tag_id')->nullable();
            // Announcements: only moderators post.
            $table->boolean('readonly')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->dateTime('archived_at')->nullable();

            $table->index(['type', 'position']);
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->dropIndex(['type', 'position']);
            $table->dropUnique(['slug']);
            $table->dropColumn(['type', 'name', 'slug', 'description', 'emoji', 'tag_id', 'readonly', 'position', 'archived_at']);
        });
    },
];
