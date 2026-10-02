<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('parley_follows', function (Blueprint $table) {
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('followed_id');
    $table->dateTime('created_at');

    $table->primary(['user_id', 'followed_id']);
    $table->index('followed_id');
    $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    $table->foreign('followed_id')->references('id')->on('users')->cascadeOnDelete();
});
