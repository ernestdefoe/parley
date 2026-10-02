<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

/*
 * Staff never read conversations. A report carries a snapshot of the reported
 * message and the five before it, taken when it is filed, so moderators see
 * what was reported even if it is later edited or deleted.
 */
return Migration::createTable('parley_reports', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('message_id')->nullable();
    $table->unsignedInteger('reporter_id')->nullable();
    $table->unsignedInteger('reported_user_id')->nullable();
    $table->string('reason', 500)->nullable();
    $table->json('snapshot');
    $table->dateTime('created_at');
    $table->dateTime('resolved_at')->nullable();
    $table->unsignedInteger('resolved_by_id')->nullable();

    $table->index('resolved_at');
    $table->foreign('message_id')->references('id')->on('parley_messages')->nullOnDelete();
    $table->foreign('reporter_id')->references('id')->on('users')->nullOnDelete();
    $table->foreign('reported_user_id')->references('id')->on('users')->nullOnDelete();
    $table->foreign('resolved_by_id')->references('id')->on('users')->nullOnDelete();
});
