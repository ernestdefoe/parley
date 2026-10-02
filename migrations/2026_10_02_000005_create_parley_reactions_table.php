<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

/*
 * One reaction per person per message, as in Messenger: picking another emoji
 * replaces the first, picking the same one takes it away.
 */
return Migration::createTable('parley_reactions', function (Blueprint $table) {
    $table->unsignedInteger('message_id');
    $table->unsignedInteger('user_id');
    $table->string('emoji', 32);
    $table->dateTime('created_at');

    $table->primary(['message_id', 'user_id']);
    $table->foreign('message_id')->references('id')->on('parley_messages')->cascadeOnDelete();
    $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
});
