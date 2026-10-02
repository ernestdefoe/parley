<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('parley_conversations', function (Blueprint $table) {
    $table->increments('id');
    $table->boolean('is_group')->default(false);
    $table->string('title', 100)->nullable();
    $table->unsignedInteger('creator_id')->nullable();
    // A one-to-one conversation is found again by its pair, not by searching
    // participants: `<low id>:<high id>`. Null for a group.
    $table->string('pair_key', 32)->nullable()->unique();
    $table->unsignedInteger('last_message_id')->nullable();
    $table->dateTime('last_message_at')->nullable()->index();
    $table->timestamps();

    $table->foreign('creator_id')->references('id')->on('users')->nullOnDelete();
});
