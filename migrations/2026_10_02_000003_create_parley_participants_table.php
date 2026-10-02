<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('parley_participants', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('conversation_id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('last_read_message_id')->nullable();
    $table->boolean('muted')->default(false);
    // Closing a conversation hides it from your list until the next message;
    // the other person keeps theirs.
    $table->dateTime('hidden_at')->nullable();
    $table->dateTime('joined_at');

    $table->unique(['conversation_id', 'user_id']);
    $table->index('user_id');
    $table->foreign('conversation_id')->references('id')->on('parley_conversations')->cascadeOnDelete();
    $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
});
