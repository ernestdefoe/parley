<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Parley 2: what each person keeps about a conversation for themselves.
 *
 * Every column is nullable or has a default, so the conversations already on
 * a forum read exactly as before: not archived, not starred, no label, a
 * plain member, and never a message request.
 */
return [
    'up' => function (Builder $schema) {
        $schema->table('parley_participants', function (Blueprint $table) {
            $table->dateTime('archived_at')->nullable()->after('hidden_at');
            $table->boolean('starred')->default(false)->after('archived_at');
            // One of Labels::COLOURS, or null.
            $table->string('label', 16)->nullable()->after('starred');
            // owner | member, in a group conversation.
            $table->string('role', 8)->default('member')->after('label');
            // Set while a first message from someone this person does not
            // follow waits in their Requests; cleared when they accept or reply.
            $table->dateTime('requested_at')->nullable()->after('role');
            // The newest message that @mentioned this person here.
            $table->unsignedInteger('last_mention_id')->nullable()->after('requested_at');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('parley_participants', function (Blueprint $table) {
            $table->dropColumn(['archived_at', 'starred', 'label', 'role', 'requested_at', 'last_mention_id']);
        });
    },
];
