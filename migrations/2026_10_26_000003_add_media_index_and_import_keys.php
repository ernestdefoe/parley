<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * The details column lists a conversation's photos, files and voice notes by
 * type, so messages get an index on (conversation, type).
 *
 * import_key marks a conversation or message brought across from another
 * extension (`gm:<dialog id>`, `gmm:<message id>` from Group Messages), so an
 * import can be run again and only adds what is new.
 */
return [
    'up' => function (Builder $schema) {
        $schema->table('parley_messages', function (Blueprint $table) {
            $table->string('import_key', 40)->nullable()->unique();
            $table->index(['conversation_id', 'type']);
        });
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->string('import_key', 40)->nullable()->unique();
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('parley_messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'type']);
            $table->dropUnique(['import_key']);
            $table->dropColumn('import_key');
        });
        $schema->table('parley_conversations', function (Blueprint $table) {
            $table->dropUnique(['import_key']);
            $table->dropColumn('import_key');
        });
    },
];
