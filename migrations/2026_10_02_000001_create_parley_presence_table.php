<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

/*
 * One row per visitor, rewritten by every heartbeat. A member is online while
 * their row is younger than the presence window; a guest is counted, never
 * listed. Rows are pruned on write, so no scheduled task is needed.
 */
return Migration::createTable('parley_presence', function (Blueprint $table) {
    $table->increments('id');
    // `u<id>` for a member, `g<hash>` for a guest. Unique, so a heartbeat is an
    // upsert and two tabs are still one person.
    $table->string('visitor_key', 64)->unique();
    $table->unsignedInteger('user_id')->nullable();
    // online | away | busy | invisible
    $table->string('status', 16)->default('online');
    // index | discussion | reply | tag | user | messages | other
    $table->string('place', 16)->default('other');
    $table->unsignedInteger('discussion_id')->nullable();
    $table->unsignedInteger('near_number')->nullable();
    $table->unsignedInteger('tag_id')->nullable();
    $table->dateTime('away_since')->nullable();
    $table->dateTime('last_seen_at')->index();

    $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    $table->foreign('discussion_id')->references('id')->on('discussions')->nullOnDelete();
});
