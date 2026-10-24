<?php

use Ernestdefoe\Parley\Images;
use Flarum\Database\Migration;
use Illuminate\Container\Container;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Purging the extension takes the pictures sent in conversations with the table.
$migration = Migration::createTable('parley_messages', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('conversation_id');
    // Null once the sender's account is deleted; the conversation keeps the
    // words so the other side of it still reads.
    $table->unsignedInteger('user_id')->nullable();
    // text | image | call — `call` rows are written by Parley Calls.
    $table->string('type', 16)->default('text');
    $table->text('body')->nullable();
    $table->json('meta')->nullable();
    $table->unsignedInteger('reply_to_id')->nullable();
    $table->dateTime('created_at');
    $table->dateTime('edited_at')->nullable();
    $table->dateTime('deleted_at')->nullable();

    $table->index(['conversation_id', 'id']);
    $table->foreign('conversation_id')->references('id')->on('parley_conversations')->cascadeOnDelete();
    $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
});

$drop = $migration['down'];
$migration['down'] = function (Builder $schema) use ($drop) {
    Images::purge(Container::getInstance());
    $drop($schema);
};

return $migration;
