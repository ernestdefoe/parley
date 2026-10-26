<?php

namespace Ernestdefoe\Parley\Tests\integration\console;

use Carbon\Carbon;
use Flarum\Testing\integration\ConsoleTestCase;
use Flarum\User\User;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\Attributes\Test;

/**
 * Group Messages' conversations come across into Parley, and running the
 * import again adds only what is new. Its tables are made here in their own
 * shape, so the test needs neither flarum/messages nor Group Messages.
 */
class ImportGroupMessagesTest extends ConsoleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, string $name) => ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'x', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $this->prepareDatabase([User::class => [$user(2, 'ana'), $user(3, 'ben'), $user(4, 'cy')]]);
    }

    protected function tearDown(): void
    {
        // MySQL does not roll back a CREATE TABLE with the test's transaction.
        $schema = $this->database()->getSchemaBuilder();
        foreach (['dialog_message_reactions', 'dialog_message_replies', 'group_dialogs', 'dialog_messages', 'dialog_user', 'dialogs'] as $table) {
            $schema->dropIfExists($table);
        }

        parent::tearDown();
    }

    private function sourceTables(): void
    {
        $schema = $this->database()->getSchemaBuilder();
        $schema->create('dialogs', function (Blueprint $t) {
            $t->increments('id');
            $t->string('type');
            $t->timestamps();
        });
        $schema->create('dialog_user', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('dialog_id');
            $t->unsignedInteger('user_id');
            $t->dateTime('joined_at');
            $t->unsignedInteger('last_read_message_id')->default(0);
        });
        $schema->create('dialog_messages', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('dialog_id');
            $t->unsignedInteger('user_id')->nullable();
            $t->text('content');
            $t->timestamps();
        });
        $schema->create('group_dialogs', function (Blueprint $t) {
            $t->unsignedInteger('dialog_id')->primary();
            $t->string('title')->nullable();
            $t->string('icon_url')->nullable();
            $t->unsignedInteger('owner_id')->nullable();
            $t->timestamps();
        });
        $schema->create('dialog_message_replies', function (Blueprint $t) {
            $t->unsignedInteger('message_id')->primary();
            $t->unsignedInteger('reply_to_id');
        });
        $schema->create('dialog_message_reactions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('message_id');
            $t->unsignedInteger('user_id');
            $t->string('reaction');
            $t->dateTime('created_at')->nullable();
        });

        $db = $this->database();
        $now = Carbon::now();
        $db->table('dialogs')->insert(['id' => 7, 'type' => 'group', 'created_at' => $now]);
        $db->table('group_dialogs')->insert(['dialog_id' => 7, 'title' => 'Committee', 'owner_id' => 2]);
        $db->table('dialog_user')->insert([
            ['dialog_id' => 7, 'user_id' => 2, 'joined_at' => $now, 'last_read_message_id' => 71],
            ['dialog_id' => 7, 'user_id' => 3, 'joined_at' => $now, 'last_read_message_id' => 72],
            ['dialog_id' => 7, 'user_id' => 4, 'joined_at' => $now, 'last_read_message_id' => 0],
        ]);
        $db->table('dialog_messages')->insert([
            ['id' => 71, 'dialog_id' => 7, 'user_id' => 2, 'content' => '<t>Agenda is up</t>', 'created_at' => $now],
            ['id' => 70, 'dialog_id' => 7, 'user_id' => 2, 'content' => '<r>See <URL url="https://example.com/a"><s>[</s>the plan<e>](https://example.com/a)</e></URL></r>', 'created_at' => $now->copy()->subMinute()],
            ['id' => 72, 'dialog_id' => 7, 'user_id' => 3, 'content' => '<r>Looks <STRONG><s>**</s>good<e>**</e></STRONG></r>', 'created_at' => $now],
        ]);
        $db->table('dialog_message_replies')->insert(['message_id' => 72, 'reply_to_id' => 71]);
        $db->table('dialog_message_reactions')->insert([
            ['message_id' => 71, 'user_id' => 3, 'reaction' => '👍', 'created_at' => $now],
            ['message_id' => 71, 'user_id' => 4, 'reaction' => 'party_popper', 'created_at' => $now],
        ]);
    }

    #[Test]
    public function nothing_to_import_without_group_messages()
    {
        $this->assertStringContainsString('not found', $this->runCommand(['command' => 'parley:import-group-messages']));
    }

    #[Test]
    public function a_group_comes_across_whole_and_a_second_run_adds_only_what_is_new()
    {
        $this->app();
        $this->sourceTables();
        $db = $this->database();

        $this->assertStringContainsString('Would import 1', $this->runCommand(['command' => 'parley:import-group-messages', '--dry-run' => true]));
        $this->assertSame(0, $db->table('parley_conversations')->count(), 'A dry run changes nothing');

        $this->runCommand(['command' => 'parley:import-group-messages']);
        $group = $db->table('parley_conversations')->where('import_key', 'gm:7')->first();
        $this->assertSame('Committee', $group->title);
        $this->assertTrue((bool) $group->is_group);

        $messages = $db->table('parley_messages')->where('conversation_id', $group->id)->orderBy('id')->get();
        $this->assertSame(['See the plan (https://example.com/a)', 'Agenda is up', 'Looks good'], $messages->pluck('body')->all(), 'Their words, without markup Parley would show as asterisks');
        $this->assertSame((int) $messages[1]->id, (int) $messages[2]->reply_to_id, 'The reply still points at its message');
        $this->assertSame(1, $db->table('parley_reactions')->count(), 'Only reactions Parley has');

        $members = $db->table('parley_participants')->where('conversation_id', $group->id)->orderBy('user_id')->get()->keyBy('user_id');
        $this->assertSame('owner', $members[2]->role);
        $this->assertSame((int) $messages[1]->id, (int) $members[2]->last_read_message_id, 'What was read stays read');
        $this->assertNull($members[4]->last_read_message_id);

        $this->runCommand(['command' => 'parley:import-group-messages']);
        $this->assertSame(3, $db->table('parley_messages')->count(), 'Running again adds nothing');

        $db->table('dialog_messages')->insert(['id' => 73, 'dialog_id' => 7, 'user_id' => 4, 'content' => '<t>One more</t>', 'created_at' => Carbon::now()]);
        $this->runCommand(['command' => 'parley:import-group-messages']);
        $this->assertSame(4, $db->table('parley_messages')->count(), 'Only the new message');
        $this->assertSame(4, $db->table('dialog_messages')->count(), 'Group Messages keeps its own');
    }
}
