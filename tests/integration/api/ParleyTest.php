<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * Users: 1 admin · 2 and 3 members talking in conversation 1 · 4 a moderator ·
 * 5 unconfirmed · 6 a member who blocks 2 · 7 who takes messages from nobody.
 * Rooms: 10 open · 11 read-only · 12 archived.
 */
class ParleyTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, string $name, array $extra = []) => $extra + ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $room = fn (int $id, string $name, array $extra = []) => $extra + ['id' => $id, 'type' => 'room', 'name' => $name, 'slug' => strtolower($name), 'position' => $id, 'created_at' => $now, 'updated_at' => $now];
        $message = fn (int $id, int $conversation, int $user, string $body, array $extra = []) => $extra + ['id' => $id, 'conversation_id' => $conversation, 'user_id' => $user, 'type' => 'text', 'body' => $body, 'created_at' => $now->copy()->addSeconds($id)];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                $user(3, 'other'), $user(4, 'moderator'), $user(5, 'unconfirmed', ['is_email_confirmed' => 0]),
                $user(6, 'blocker'), $user(7, 'closed', ['preferences' => json_encode(['parleyWhoCanMessage' => 'nobody'])]),
            ],
            'group_user' => [['user_id' => 4, 'group_id' => Group::MODERATOR_ID]],
            'parley_conversations' => [
                ['id' => 1, 'type' => 'direct', 'pair_key' => '2:3', 'creator_id' => 2, 'last_message_id' => 2, 'created_at' => $now, 'updated_at' => $now],
                $room(10, 'Lobby'), $room(11, 'News', ['readonly' => true]), $room(12, 'Old', ['archived_at' => $now]),
            ],
            'parley_participants' => [
                ['conversation_id' => 1, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 1, 'user_id' => 3, 'joined_at' => $now],
                ['conversation_id' => 10, 'user_id' => 3, 'joined_at' => $now],
            ],
            'parley_messages' => [
                $message(1, 1, 2, 'Hello there'), $message(2, 1, 3, 'Hi back'), $message(3, 10, 3, 'Morning all'),
            ],
            'parley_blocks' => [['user_id' => 6, 'blocked_id' => 2, 'created_at' => $now]],
        ]);
    }

    private function call(string $method, string $path, ?int $actor, array $body = [], array $query = []): array
    {
        $request = $this->request($method, $path, ($actor ? ['authenticatedAs' => $actor] : []) + ($body ? ['json' => $body] : []));
        $response = $this->send($query ? $request->withQueryParams($query) : $request);

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    #[Test]
    public function the_forum_says_who_can_use_and_moderate_parley()
    {
        $parley = fn (?int $actor) => $this->call('GET', '/api', $actor)[1]['data']['attributes']['parley'];

        $this->assertFalse($parley(null)['canUse']);
        $this->assertTrue($parley(2)['canUse']);
        $this->assertFalse($parley(2)['canModerate']);
        $this->assertTrue($parley(4)['canModerate']);
        $this->assertSame(8, $parley(2)['maxImageMb']);
    }

    #[Test]
    public function a_conversation_is_read_only_by_the_people_in_it()
    {
        [$status, $body] = $this->call('GET', '/api/parley/conversations/1', 3);
        $this->assertSame(200, $status);
        $this->assertSame(['Hello there', 'Hi back'], array_column($body['messages'], 'body'));

        $this->assertSame(404, $this->call('GET', '/api/parley/conversations/1', 4)[0], 'Not even a moderator reads a private conversation');
        $this->assertSame(404, $this->call('POST', '/api/parley/conversations/1/messages', 4, ['body' => 'Intruding'])[0]);
        $this->assertSame(401, $this->call('GET', '/api/parley/conversations/1', null)[0]);
    }

    #[Test]
    public function the_conversation_list_is_your_own()
    {
        [, $mine] = $this->call('GET', '/api/parley/conversations', 2);
        [, $theirs] = $this->call('GET', '/api/parley/conversations', 4);

        $this->assertSame([1], array_map('intval', array_column($mine['conversations'], 'id')));
        $this->assertSame([], $theirs['conversations']);
    }

    #[Test]
    public function the_conversation_list_loads_without_a_query_per_conversation()
    {
        $this->app();
        $now = Carbon::now();
        foreach (range(20, 26) as $id) {
            $this->database()->table('users')->insert(['id' => $id, 'username' => "friend$id", 'email' => "f$id@machine.local", 'password' => 'x', 'is_email_confirmed' => 1, 'joined_at' => $now]);
            $this->database()->table('parley_conversations')->insert(['id' => $id, 'type' => 'direct', 'pair_key' => "2:$id", 'creator_id' => 2, 'created_at' => $now, 'updated_at' => $now]);
            $this->database()->table('parley_participants')->insert([['conversation_id' => $id, 'user_id' => 2, 'joined_at' => $now], ['conversation_id' => $id, 'user_id' => $id, 'joined_at' => $now]]);
            $this->database()->table('parley_messages')->insert(['id' => $id, 'conversation_id' => $id, 'user_id' => $id, 'type' => 'text', 'body' => "Hi from $id", 'created_at' => $now]);
            $this->database()->table('parley_conversations')->where('id', $id)->update(['last_message_id' => $id, 'last_message_at' => $now]);
        }

        // Eight conversations with eight people: flarum/testing fails the
        // request on a query repeated per conversation.
        [$status, $body] = $this->call('GET', '/api/parley/conversations', 2);
        $this->assertSame(200, $status);
        $this->assertCount(8, $body['conversations']);
    }

    #[Test]
    public function opening_a_conversation_respects_blocks_settings_and_confirmation()
    {
        $open = fn (int $actor, int $other) => $this->call('POST', '/api/parley/conversations', $actor, ['userId' => $other])[0];

        $this->assertSame(422, $open(2, 6), 'Blocked');
        $this->assertSame(422, $open(6, 2), 'Either way');
        $this->assertSame(422, $open(2, 7), 'Takes messages from nobody');
        $this->assertSame(200, $open(4, 7), 'Staff can still reach them');
        $this->assertSame(422, $open(2, 2), 'Yourself');
        $this->assertSame(403, $open(5, 2), 'Unconfirmed: no Members group, so no Parley');

        $this->assertSame(200, $open(2, 3), 'An existing pair reopens');
        $this->assertSame(1, $this->database()->table('parley_conversations')->where('pair_key', '2:3')->count());
    }

    #[Test]
    public function only_its_author_edits_a_message_and_a_moderator_may_delete_one_only_in_a_room()
    {
        $this->assertSame(403, $this->call('PATCH', '/api/parley/messages/1', 3, ['body' => 'Forged'])[0], 'The other participant');
        $this->assertSame(404, $this->call('PATCH', '/api/parley/messages/1', 4, ['body' => 'Forged'])[0], 'Someone outside it');
        $this->assertSame(200, $this->call('PATCH', '/api/parley/messages/1', 2, ['body' => 'Edited'])[0]);
        $this->assertSame('Edited', $this->database()->table('parley_messages')->where('id', 1)->value('body'));

        $this->assertSame(404, $this->call('DELETE', '/api/parley/messages/2', 4)[0], 'A moderator cannot reach into a private conversation');
        $this->assertSame(200, $this->call('DELETE', '/api/parley/messages/3', 4)[0], 'But tidies a room');
        $this->assertNotNull($this->database()->table('parley_messages')->where('id', 3)->value('deleted_at'));
    }

    #[Test]
    public function reactions_are_known_ones_on_messages_you_can_see()
    {
        $this->assertSame(422, $this->call('POST', '/api/parley/messages/1/react', 3, ['emoji' => 'banana'])[0]);
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/1/react', 4, ['emoji' => '👍'])[0]);

        $this->call('POST', '/api/parley/messages/1/react', 3, ['emoji' => '👍']);
        $this->assertSame(1, $this->database()->table('parley_reactions')->where('message_id', 1)->count());
        $this->call('POST', '/api/parley/messages/1/react', 3, ['emoji' => '👍']);
        $this->assertSame(0, $this->database()->table('parley_reactions')->where('message_id', 1)->count(), 'The same reaction again takes it back');
    }

    #[Test]
    public function reports_go_to_moderators_who_alone_can_read_and_resolve_them()
    {
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/1/report', 2, ['reason' => 'Mine'])[0], 'Not your own message');
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/1/report', 4, ['reason' => 'Nosy'])[0], 'Not a conversation you are in');
        $this->assertSame(200, $this->call('POST', '/api/parley/messages/1/report', 3, ['reason' => 'Rude'])[0]);
        $this->assertSame(1, $this->database()->table('notifications')->where('user_id', 4)->where('type', 'parleyReport')->count());

        $this->assertSame(403, $this->call('GET', '/api/parley/reports', 3)[0]);
        [$status, $body] = $this->call('GET', '/api/parley/reports', 4);
        $this->assertSame(200, $status);
        $this->assertCount(1, $body['reports']);

        $id = (int) $this->database()->table('parley_reports')->value('id');
        $this->assertSame([], $this->call('POST', "/api/parley/reports/$id/resolve", 4)[1]['reports']);
    }

    #[Test]
    public function rooms_take_posts_from_members_unless_read_only_or_archived()
    {
        $post = fn (int $actor, int $room) => $this->call('POST', "/api/parley/conversations/$room/messages", $actor, ['body' => 'Hello room'])[0];

        $this->assertSame(200, $post(2, 10));
        $this->assertSame(1, $this->database()->table('parley_participants')->where('conversation_id', 10)->where('user_id', 2)->count(), 'Posting joins');
        $this->assertSame(422, $post(2, 11), 'Read-only');
        $this->assertSame(200, $post(4, 11), 'Except for moderators');
        $this->assertSame(404, $post(2, 12), 'Archived rooms are gone');
        $this->assertSame(403, $post(5, 10), 'Unconfirmed');
    }

    #[Test]
    public function managing_rooms_is_for_admins()
    {
        $this->assertSame(403, $this->call('GET', '/api/parley/admin/rooms', 4)[0]);
        $this->assertSame(403, $this->call('POST', '/api/parley/admin/rooms', 4, ['name' => 'Mods'])[0]);
        $this->assertSame(403, $this->call('DELETE', '/api/parley/admin/rooms/10', 4)[0]);

        $this->assertSame(200, $this->call('POST', '/api/parley/admin/rooms', 1, ['name' => 'Help desk'])[0]);
        $this->assertSame(1, $this->database()->table('parley_conversations')->where('name', 'Help desk')->count());
    }

    #[Test]
    public function people_search_leaves_out_yourself_and_anyone_blocked()
    {
        [$status, $body] = $this->call('GET', '/api/parley/people', 2, [], ['q' => 'o']);
        $this->assertSame(200, $status);
        $this->assertSame([], $body['people'], 'Too short a search');

        [, $body] = $this->call('GET', '/api/parley/people', 2, [], ['q' => 'er']);
        $names = array_column($body['people'], 'username');
        $this->assertContains('other', $names);
        $this->assertNotContains('blocker', $names);
        $this->assertNotContains('normal', $names);
    }

    #[Test]
    public function preferences_take_only_known_values()
    {
        $set = function (string $key, string $value): ?string {
            $this->call('PATCH', '/api/users/2', 2, ['data' => ['type' => 'users', 'id' => '2', 'attributes' => ['preferences' => [$key => $value]]]]);

            return json_decode((string) $this->database()->table('users')->where('id', 2)->value('preferences'), true)[$key] ?? null;
        };

        $this->assertSame('busy', $set('parleyStatus', 'busy'));
        $this->assertSame('online', $set('parleyStatus', 'stalking'));
        $this->assertSame('everyone', $set('parleyWhoCanMessage', 'my-enemies'));
    }

    #[Test]
    public function a_heartbeat_puts_a_member_in_the_online_list_unless_they_appear_offline()
    {
        [$status, $body] = $this->call('POST', '/api/parley/heartbeat', 2, ['status' => 'online', 'place' => 'index']);
        $this->assertSame(200, $status);
        $this->assertArrayHasKey('rooms', $body);

        $this->call('POST', '/api/parley/heartbeat', 3, ['status' => 'invisible', 'place' => 'index']);
        $this->assertSame('invisible', json_decode((string) $this->database()->table('users')->where('id', 3)->value('preferences'), true)['parleyStatus']);

        $online = fn (int $viewer) => array_map('intval', array_column($this->call('POST', '/api/parley/heartbeat', $viewer, ['status' => 'online'])[1]['online'] ?? [], 'id'));
        $this->assertContains(2, $online(4));
        $this->assertNotContains(3, $online(4), 'Appear offline means offline');
    }
}
