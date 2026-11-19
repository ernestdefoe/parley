<?php

namespace Ernestdefoe\Parley\Tests\integration\console;

use Carbon\Carbon;
use Ernestdefoe\Parley\Console\ImportRamonCommand;
use Flarum\Testing\integration\ConsoleTestCase;
use Flarum\User\User;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\Attributes\Test;

/**
 * parley:import-ramon brings ramon/chat's direct channels across as
 * conversations and its tag channels as rooms, replies and read places kept,
 * and a second run adds nothing.
 */
class ImportRamonTest extends ConsoleTestCase
{
    private const TABLES = ['chat_messages', 'chat_channel_user', 'chat_channels'];

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
        foreach (self::TABLES as $table) {
            $this->database()->getSchemaBuilder()->dropIfExists($table);
        }

        // ...so what the import wrote was committed too: take it away, or
        // the next run's fixtures collide with it.
        if ($this->database()->getDriverName() === 'mysql') {
            foreach (['parley_reactions', 'parley_pins', 'parley_messages', 'parley_participants', 'parley_conversations'] as $table) {
                $this->database()->table($table)->delete();
            }
            $this->database()->table('settings')->where('key', 'ernestdefoe-parley.ramon_imported')->delete();
        }

        parent::tearDown();
    }

    private function sourceTables(): void
    {
        $schema = $this->database()->getSchemaBuilder();
        $schema->create('chat_channels', function (Blueprint $t) {
            $t->increments('id');
            $t->string('type');
            $t->string('name')->nullable();
            $t->string('slug')->nullable();
            $t->string('description')->nullable();
            $t->string('emoji')->nullable();
            $t->unsignedInteger('tag_id')->nullable();
            $t->string('post_permission')->nullable();
            $t->string('status')->nullable();
            $t->dateTime('archived_at')->nullable();
            $t->unsignedInteger('creator_id')->nullable();
            $t->timestamps();
            $t->dateTime('deleted_at')->nullable();
        });
        $schema->create('chat_channel_user', function (Blueprint $t) {
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('last_read_message_id')->nullable();
            $t->boolean('muted')->default(false);
            $t->dateTime('joined_at')->nullable();
        });
        $schema->create('chat_messages', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('user_id')->nullable();
            $t->unsignedInteger('thread_id')->nullable();
            $t->unsignedInteger('reply_to_id')->nullable();
            $t->string('type')->nullable();
            $t->text('content')->nullable();
            $t->dateTime('created_at')->nullable();
            $t->dateTime('edited_at')->nullable();
            $t->dateTime('deleted_at')->nullable();
        });

        $db = $this->database();
        $now = Carbon::now();
        $uniform = fn (array $rows) => array_map(fn ($r) => $r + array_fill_keys(array_keys(array_merge(...$rows)), null), $rows);
        $db->table('chat_channels')->insert($uniform([
            ['id' => 1, 'type' => 'direct', 'creator_id' => 2, 'created_at' => $now],
            ['id' => 2, 'type' => 'public', 'name' => 'Game day', 'slug' => 'game-day', 'creator_id' => 2, 'post_permission' => 'moderators', 'created_at' => $now],
        ]));
        $db->table('chat_channel_user')->insert($uniform([
            ['channel_id' => 1, 'user_id' => 2, 'last_read_message_id' => 11, 'joined_at' => $now],
            ['channel_id' => 1, 'user_id' => 3, 'last_read_message_id' => 10, 'joined_at' => $now],
            ['channel_id' => 2, 'user_id' => 3, 'joined_at' => $now],
        ]));
        $db->table('chat_messages')->insert($uniform([
            ['id' => 10, 'channel_id' => 1, 'user_id' => 2, 'type' => 'text', 'content' => '<t>Kickoff at noon?</t>', 'created_at' => $now],
            ['id' => 11, 'channel_id' => 1, 'user_id' => 3, 'type' => 'text', 'reply_to_id' => 10, 'content' => '<t>Noon works</t>', 'created_at' => $now],
            ['id' => 12, 'channel_id' => 1, 'user_id' => null, 'type' => 'system', 'content' => null, 'created_at' => $now],
            ['id' => 20, 'channel_id' => 2, 'user_id' => 2, 'type' => 'text', 'content' => '<t>Welcome</t>', 'created_at' => $now],
        ]));
    }

    #[Test]
    public function nothing_to_import_without_ramon_chat()
    {
        $this->assertStringContainsString('were not found', $this->runCommand(['command' => 'parley:import-ramon']));
    }

    #[Test]
    public function direct_channels_and_tag_channels_come_across_once()
    {
        $this->sourceTables();
        $db = $this->database();

        // Counted, not assumed empty: MySQL commits the test's transaction at
        // CREATE TABLE, so rows from earlier tests can still be there.
        $before = $db->table('parley_messages')->count();
        $dry = $this->runCommand(['command' => 'parley:import-ramon', '--dry-run' => true]);
        $this->assertStringContainsString('Would import 1 conversation(s), 2 message(s).', $dry);
        $this->assertStringContainsString('Would import 1 room(s) from tag channels, 1 message(s).', $dry);
        $this->assertSame($before, $db->table('parley_messages')->count(), 'A dry run changes nothing');

        $this->runCommand(['command' => 'parley:import-ramon']);

        $direct = $db->table('parley_conversations')->where('pair_key', '2:3')->first();
        $this->assertNotNull($direct);
        $messages = $db->table('parley_messages')->where('conversation_id', $direct->id)->orderBy('id')->get();
        $this->assertSame(['Kickoff at noon?', 'Noon works'], $messages->pluck('body')->all(), 'Only what people said');
        $this->assertSame((int) $messages[0]->id, (int) $messages[1]->reply_to_id, 'The reply points at its message');
        $this->assertSame((int) $messages[1]->id, (int) $direct->last_message_id);
        $this->assertSame((int) $messages[0]->id, (int) $db->table('parley_participants')->where(['conversation_id' => $direct->id, 'user_id' => 3])->value('last_read_message_id'));

        $room = $db->table('parley_conversations')->where('type', 'room')->where('slug', 'game-day')->first();
        $this->assertNotNull($room);
        $this->assertSame('Game day', $room->name);
        $this->assertTrue((bool) $room->readonly);
        $this->assertSame(1, $db->table('parley_participants')->where('conversation_id', $room->id)->count());

        $count = $db->table('parley_messages')->count();
        $this->runCommand(['command' => 'parley:import-ramon']);
        $this->assertSame($count, $db->table('parley_messages')->count(), 'A second run adds nothing');
    }

    #[Test]
    public function channels_are_read_a_chunk_at_a_time_and_members_written_in_one_statement()
    {
        $this->sourceTables();
        $db = $this->database();
        $now = Carbon::now();

        // One chunk and one more: group channels 100.., then a second
        // channel between 2 and 3 that must land in the conversation the
        // first chunk opened for them (pair_key is unique).
        $groups = range(100, 100 + ImportRamonCommand::CHUNK - 1);
        $db->table('chat_channels')->insert(array_map(fn ($id) => ['id' => $id, 'type' => 'direct', 'name' => "Group $id", 'creator_id' => 2, 'created_at' => $now], $groups));
        $db->table('chat_channels')->insert(['id' => 500, 'type' => 'direct', 'creator_id' => 3, 'created_at' => $now]);
        $members = [['channel_id' => 500, 'user_id' => 2], ['channel_id' => 500, 'user_id' => 3]];
        $said = [['id' => 5000, 'channel_id' => 500, 'user_id' => 3, 'type' => 'text', 'content' => '<t>Second channel, https://example.com</t>', 'created_at' => $now]];
        foreach ($groups as $id) {
            foreach ([2, 3, 4] as $user) {
                $members[] = ['channel_id' => $id, 'user_id' => $user];
            }
            $said[] = ['id' => $id * 10, 'channel_id' => $id, 'user_id' => 2, 'type' => 'text', 'content' => "<t>Hello $id</t>", 'created_at' => $now];
        }
        $db->table('chat_channel_user')->insert($members);
        $db->table('chat_messages')->insert($said);

        $db->flushQueryLog();
        $db->enableQueryLog();
        $this->runCommand(['command' => 'parley:import-ramon']);
        $log = $db->getQueryLog();
        $db->disableQueryLog();

        $direct = $db->table('parley_conversations')->where('pair_key', '2:3')->first();
        $this->assertSame(3, $db->table('parley_messages')->where('conversation_id', $direct->id)->count(), 'Both channels between 2 and 3 share one conversation');
        $this->assertTrue((bool) $db->table('parley_messages')->where('conversation_id', $direct->id)->orderByDesc('id')->value('has_link'));
        $this->assertSame(ImportRamonCommand::CHUNK, $db->table('parley_conversations')->where('is_group', true)->where('type', 'direct')->count());
        $this->assertSame(3 * ImportRamonCommand::CHUNK + 2 + 1, $db->table('parley_participants')->count());

        $touching = fn (string $table, string $verb) => count(array_filter($log, fn ($q) => stripos($q['query'], $verb) === 0 && str_contains($q['query'], $table)));
        // Two chunks of direct channels and one of tag channels.
        $this->assertSame(3, $touching('chat_channel_user', 'select'), 'Members are read per chunk, not per channel');
        // CHUNK groups, the 2:3 conversation twice and the room.
        $this->assertSame(ImportRamonCommand::CHUNK + 3, $touching('parley_participants', 'insert'), 'One statement per conversation, not per member');
    }
}
