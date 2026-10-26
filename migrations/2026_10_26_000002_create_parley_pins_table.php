<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

// Messages pinned to the top of a conversation, shared by everyone in it.
return Migration::createTable('parley_pins', function (Blueprint $table) {
    $table->unsignedInteger('message_id')->primary();
    $table->unsignedInteger('conversation_id');
    $table->unsignedInteger('user_id')->nullable();
    $table->dateTime('created_at');
    $table->index(['conversation_id', 'created_at']);
    $table->foreign('message_id')->references('id')->on('parley_messages')->cascadeOnDelete();
    $table->foreign('conversation_id')->references('id')->on('parley_conversations')->cascadeOnDelete();
    $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
});
