<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\Attributes\Test;

/**
 * Parley 2: groups, requests, pins, forwarding, search, files and the inbox.
 *
 * Users: 1 admin · 2 normal · 3 other (follows 2) · 4 moderator · 6 blocks 2 ·
 * 7 takes messages from nobody · 8 "everyone, straight to my inbox" ·
 * 9 a stranger to 2 · 10 another member.
 * Conversation 1: 2 and 3. Conversation 2: 4 and 10 (2 is not in it).
 * Room 20: open. Room 21: tied to a tag, which nobody can see here (no
 * flarum/tags in the test install), so it stands for a room you lost.
 */
class Parley2Test extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, string $name, array $extra = []) => $extra + ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $message = fn (int $id, int $conversation, int $user, string $body, array $extra = []) => $extra + ['id' => $id, 'conversation_id' => $conversation, 'user_id' => $user, 'type' => 'text', 'body' => $body, 'created_at' => $now->copy()->addSeconds($id)];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                $user(3, 'other'), $user(4, 'moderator'),
                $user(6, 'blocker'), $user(7, 'closed', ['preferences' => json_encode(['parleyWhoCanMessage' => 'nobody'])]),
                $user(8, 'open', ['preferences' => json_encode(['parleyWhoCanMessage' => 'everyone_inbox'])]),
                $user(9, 'stranger'), $user(10, 'member10'),
            ],
            'group_user' => [['user_id' => 4, 'group_id' => Group::MODERATOR_ID]],
            'parley_conversations' => [
                ['id' => 1, 'type' => 'direct', 'pair_key' => '2:3', 'creator_id' => 2, 'last_message_id' => 2, 'last_message_at' => $now->copy()->addSeconds(2), 'created_at' => $now, 'updated_at' => $now],
                ['id' => 2, 'type' => 'direct', 'pair_key' => '4:10', 'creator_id' => 4, 'last_message_id' => 3, 'last_message_at' => $now->copy()->addSeconds(3), 'created_at' => $now, 'updated_at' => $now],
                ['id' => 20, 'type' => 'room', 'name' => 'Lobby', 'slug' => 'lobby', 'is_group' => true, 'last_message_id' => 4, 'created_at' => $now, 'updated_at' => $now],
                ['id' => 21, 'type' => 'room', 'name' => 'Staff room', 'slug' => 'staff-room', 'is_group' => true, 'tag_id' => 1, 'last_message_id' => 5, 'created_at' => $now, 'updated_at' => $now],
            ],
            'parley_participants' => [
                ['conversation_id' => 1, 'user_id' => 2, 'joined_at' => $now, 'last_read_message_id' => 2],
                ['conversation_id' => 1, 'user_id' => 3, 'joined_at' => $now, 'last_read_message_id' => 2],
                ['conversation_id' => 2, 'user_id' => 4, 'joined_at' => $now],
                ['conversation_id' => 2, 'user_id' => 10, 'joined_at' => $now],
                ['conversation_id' => 20, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 21, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 21, 'user_id' => 4, 'joined_at' => $now],
            ],
            'parley_messages' => [
                $message(1, 1, 2, 'Hello there'), $message(2, 1, 3, 'Hi back, see https://example.com'),
                $message(3, 2, 4, 'Secret plans for the banana'),
                $message(4, 20, 2, 'Banana bread in the lobby'),
                $message(5, 21, 4, 'Staff banana budget'),
            ],
            'parley_follows' => [['user_id' => 3, 'followed_id' => 2, 'created_at' => $now]],
            'parley_blocks' => [['user_id' => 6, 'blocked_id' => 2, 'created_at' => $now]],
        ]);
    }

    private function call(string $method, string $path, ?int $actor, array $body = [], array $query = []): array
    {
        $request = $this->request($method, $path, ($actor ? ['authenticatedAs' => $actor] : []) + ($body ? ['json' => $body] : []));
        $response = $this->send($query ? $request->withQueryParams($query) : $request);

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true), $response];
    }

    private function upload(int $actor, int $conversation, string $bytes, string $name, string $kind, array $extra = []): array
    {
        $tmp = tempnam(sys_get_temp_dir(), 'pt');
        file_put_contents($tmp, $bytes);

        $request = $this->request('POST', "/api/parley/conversations/$conversation/files", ['authenticatedAs' => $actor])
            ->withUploadedFiles(['file' => new UploadedFile($tmp, strlen($bytes), UPLOAD_ERR_OK, $name, 'application/octet-stream')])
            ->withParsedBody(['kind' => $kind] + $extra);
        $response = $this->send($request);

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    private function list(int $actor, string $filter = 'all'): array
    {
        return array_map('intval', array_column($this->call('GET', '/api/parley/conversations', $actor, [], ['filter' => $filter])[1]['conversations'], 'id'));
    }

    // ── Groups ──────────────────────────────────────────────────────────────

    #[Test]
    public function a_group_needs_three_people_each_of_whom_may_be_messaged()
    {
        $create = fn (int $actor, array $ids, ?string $name = null) => $this->call('POST', '/api/parley/groups', $actor, ['userIds' => $ids, 'name' => $name]);

        $this->assertSame(422, $create(2, [3])[0], 'Two people is a direct conversation');
        $this->assertSame(422, $create(2, [3, 6])[0], 'Someone who blocked you');
        $this->assertSame(422, $create(2, [3, 7])[0], 'Someone who takes messages from nobody');
        $this->assertSame(404, $create(2, [3, 999])[0], 'Someone who does not exist');
        $this->assertSame(422, $create(2, [3, 10], str_repeat('x', 81))[0], 'A name too long');

        [$status, $body] = $create(2, [3, 10], 'Weekend plans');
        $this->assertSame(200, $status);
        $this->assertTrue($body['conversation']['isGroup']);
        $this->assertSame('Weekend plans', $body['conversation']['title']);
        $this->assertSame(3, $body['conversation']['memberCount']);
        $this->assertSame('owner', $body['conversation']['role']);
        $this->assertSame('system', $body['messages'][0]['type']);
    }

    #[Test]
    public function a_group_is_seen_and_changed_only_by_its_members()
    {
        $id = $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 10], 'name' => 'Trio'])[1]['conversation']['id'];

        $this->assertSame(404, $this->call('GET', "/api/parley/conversations/$id", 4)[0], 'Not even a moderator');
        $this->assertSame(404, $this->call('POST', "/api/parley/conversations/$id/messages", 9, ['body' => 'Hi'])[0]);
        $this->assertSame(404, $this->call('PATCH', "/api/parley/conversations/$id", 9, ['name' => 'Mine now'])[0]);
        $this->assertSame(404, $this->call('POST', "/api/parley/conversations/$id/members", 9, ['userIds' => [9]])[0]);
        $this->assertSame(404, $this->call('DELETE', "/api/parley/conversations/$id/members/3", 9)[0]);
        $this->assertSame(404, $this->call('GET', "/api/parley/conversations/$id/details", 9)[0]);

        $this->assertSame(200, $this->call('PATCH', "/api/parley/conversations/$id", 3, ['name' => 'Renamed'])[0], 'Any member renames');
        $this->assertSame('Renamed', $this->database()->table('parley_conversations')->where('id', $id)->value('title'));

        $this->assertSame(404, $this->call('PATCH', '/api/parley/conversations/1', 2, ['name' => 'Nope'])[0], 'A one-to-one is not a group');
    }

    #[Test]
    public function only_the_owner_removes_people_and_an_owner_who_leaves_hands_it_on()
    {
        $id = $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 10]])[1]['conversation']['id'];

        $this->assertSame(403, $this->call('DELETE', "/api/parley/conversations/$id/members/10", 3)[0], 'A member cannot remove another');
        $this->assertSame(200, $this->call('POST', "/api/parley/conversations/$id/members", 3, ['userIds' => [8]])[0], 'But can add');
        $this->assertSame(422, $this->call('POST', "/api/parley/conversations/$id/members", 3, ['userIds' => [6]])[0], 'Not beside someone they blocked, whoever adds them');

        $this->assertSame(200, $this->call('DELETE', "/api/parley/conversations/$id/members/8", 2)[0], 'The owner removes');
        $this->assertSame(404, $this->call('GET', "/api/parley/conversations/$id", 8)[0], 'And they are out');

        [$status, $body] = $this->call('DELETE', "/api/parley/conversations/$id/members/2", 2);
        $this->assertSame(200, $status);
        $this->assertTrue($body['left']);
        $this->assertSame('owner', $this->database()->table('parley_participants')->where('conversation_id', $id)->where('user_id', 3)->value('role'), 'The longest-standing member owns it now');

        $this->call('DELETE', "/api/parley/conversations/$id/members/3", 3);
        $this->call('DELETE', "/api/parley/conversations/$id/members/10", 10);
        $this->assertSame(0, $this->database()->table('parley_conversations')->where('id', $id)->count(), 'The last one out leaves nothing behind');
    }

    #[Test]
    public function an_at_mention_in_a_group_alerts_that_member_only()
    {
        // 3 follows 2, so the group is in 3's inbox; 10 does not, so it waits
        // in 10's Requests, and a request does not alert.
        $id = $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 10]])[1]['conversation']['id'];

        $this->call('POST', "/api/parley/conversations/$id/messages", 2, ['body' => 'Ask @other, @member10 and @moderator']);

        $mentions = fn (int $user) => $this->database()->table('notifications')->where('user_id', $user)->where('type', 'parleyRoomMention')->count();
        $this->assertSame(1, $mentions(3));
        $this->assertSame(0, $mentions(10), 'Still a request');
        $this->assertSame(0, $mentions(4), 'Not a member');
        $this->assertContains($id, $this->list(3, 'mentions'));
        $this->assertContains($id, $this->list(10, 'requests'));
    }

    // ── Requests ────────────────────────────────────────────────────────────

    #[Test]
    public function a_first_message_from_a_stranger_waits_quietly_in_requests()
    {
        [, $opened] = $this->call('POST', '/api/parley/conversations', 9, ['userId' => 2]);
        $id = $opened['conversation']['id'];
        $this->call('POST', "/api/parley/conversations/$id/messages", 9, ['body' => 'Hey, got a minute?']);

        $this->assertNotContains($id, $this->list(2), 'Not in the inbox');
        $this->assertContains($id, $this->list(2, 'requests'));
        $this->assertSame(0, $this->database()->table('notifications')->where('user_id', 2)->where('type', 'parleyMessage')->count(), 'No alert');

        [, $beat] = $this->call('POST', '/api/parley/heartbeat', 2, ['status' => 'online']);
        $this->assertSame(1, $beat['requests']);
        $this->assertArrayNotHasKey((string) $id, (array) $beat['unread'], 'No badge');

        $this->assertSame(200, $this->call('POST', "/api/parley/conversations/$id/accept", 2)[0]);
        $this->assertContains($id, $this->list(2));
        $this->assertNotContains($id, $this->list(2, 'requests'));
    }

    #[Test]
    public function replying_accepts_and_followed_people_staff_and_open_inboxes_skip_requests()
    {
        $id = $this->call('POST', '/api/parley/conversations', 9, ['userId' => 2])[1]['conversation']['id'];
        $this->call('POST', "/api/parley/conversations/$id/messages", 9, ['body' => 'Hello']);
        $this->call('POST', "/api/parley/conversations/$id/messages", 2, ['body' => 'Hi!']);
        $this->assertContains($id, $this->list(2), 'Replying is accepting');

        // 2 follows nobody; 3 follows 2, so 2 → 3 goes straight in.
        $a = $this->call('POST', '/api/parley/conversations', 2, ['userId' => 10])[1]['conversation']['id'];
        $this->assertNotNull($this->database()->table('parley_participants')->where('conversation_id', $a)->where('user_id', 10)->value('requested_at'));

        $b = $this->call('POST', '/api/parley/conversations', 4, ['userId' => 9])[1]['conversation']['id'];
        $this->assertNull($this->database()->table('parley_participants')->where('conversation_id', $b)->where('user_id', 9)->value('requested_at'), 'Staff');

        $c = $this->call('POST', '/api/parley/conversations', 2, ['userId' => 8])[1]['conversation']['id'];
        $this->assertNull($this->database()->table('parley_participants')->where('conversation_id', $c)->where('user_id', 8)->value('requested_at'), 'Straight to my inbox');

        $this->database()->table('parley_follows')->insert(['user_id' => 9, 'followed_id' => 4, 'created_at' => Carbon::now()]);
        $this->assertSame(200, $this->call('POST', '/api/parley/conversations', 4, ['userId' => 9])[0]);
    }

    #[Test]
    public function the_who_can_message_me_setting_takes_the_new_choice()
    {
        $this->call('PATCH', '/api/users/2', 2, ['data' => ['type' => 'users', 'id' => '2', 'attributes' => ['preferences' => ['parleyWhoCanMessage' => 'everyone_inbox']]]]);
        $this->assertSame('everyone_inbox', json_decode((string) $this->database()->table('users')->where('id', 2)->value('preferences'), true)['parleyWhoCanMessage']);
    }

    // ── Inbox ───────────────────────────────────────────────────────────────

    #[Test]
    public function archive_star_mute_and_labels_file_the_conversation_for_you_alone()
    {
        $set = fn (array $changes) => $this->call('POST', '/api/parley/conversations/1/settings', 2, $changes)[0];

        $this->assertSame(422, $set(['label' => 'chartreuse']));
        $this->assertSame(200, $set(['starred' => true, 'label' => 'green', 'muted' => true]));
        $this->assertContains(1, $this->list(2, 'starred'));
        $this->assertContains(1, $this->list(2, 'muted'));
        $this->assertNotContains(1, $this->list(3, 'starred'), 'The other person keeps their own view');

        $this->assertSame(200, $set(['archived' => true]));
        $this->assertNotContains(1, $this->list(2));
        $this->assertContains(1, $this->list(2, 'archived'));

        // A message to a muted, archived conversation leaves it where it is…
        $this->call('POST', '/api/parley/conversations/1/messages', 3, ['body' => 'Still there?']);
        $this->assertContains(1, $this->list(2, 'archived'));

        // …and to one only archived, brings it back.
        $set(['muted' => false]);
        $this->call('POST', '/api/parley/conversations/1/messages', 3, ['body' => 'Hello?']);
        $this->assertContains(1, $this->list(2));
        $this->assertContains(1, $this->list(2, 'unread'));

        $this->assertSame(404, $this->call('POST', '/api/parley/conversations/2/settings', 2, ['starred' => true])[0], 'Not your conversation');
    }

    #[Test]
    public function the_inbox_and_its_groups_load_without_a_query_per_conversation()
    {
        $this->app();
        $now = Carbon::now();
        foreach (range(30, 49) as $id) {
            $this->database()->table('users')->insert(['id' => $id, 'username' => "friend$id", 'email' => "f$id@machine.local", 'password' => 'x', 'is_email_confirmed' => 1, 'joined_at' => $now]);
            $this->database()->table('parley_conversations')->insert(['id' => $id, 'type' => 'direct', 'is_group' => $id % 2, 'title' => "Group $id", 'creator_id' => 2, 'created_at' => $now, 'updated_at' => $now]);
            $this->database()->table('parley_participants')->insert([['conversation_id' => $id, 'user_id' => 2, 'joined_at' => $now], ['conversation_id' => $id, 'user_id' => $id, 'joined_at' => $now], ['conversation_id' => $id, 'user_id' => 3, 'joined_at' => $now]]);
            $this->database()->table('parley_messages')->insert(['id' => $id, 'conversation_id' => $id, 'user_id' => $id, 'type' => 'text', 'body' => "Hi from $id", 'created_at' => $now]);
            $this->database()->table('parley_pins')->insert(['message_id' => $id, 'conversation_id' => $id, 'user_id' => 2, 'created_at' => $now]);
            $this->database()->table('parley_conversations')->where('id', $id)->update(['last_message_id' => $id, 'last_message_at' => $now]);
        }

        // Twenty-one conversations, half of them groups: flarum/testing fails
        // the request on a query repeated per conversation.
        foreach (['all', 'groups', 'pinned', 'unread'] as $filter) {
            [$status, $body] = $this->call('GET', '/api/parley/conversations', 2, [], ['filter' => $filter]);
            $this->assertSame(200, $status, $filter);
        }
        $this->assertCount(21, $this->call('GET', '/api/parley/conversations', 2)[1]['conversations']);
        $this->assertCount(10, $this->call('GET', '/api/parley/conversations', 2, [], ['filter' => 'groups'])[1]['conversations']);
        $this->assertSame(200, $this->call('GET', '/api/parley/search', 2, [], ['q' => 'Hi from'])[0]);
    }

    // ── Pins and forwarding ─────────────────────────────────────────────────

    #[Test]
    public function pins_are_for_the_people_in_it_and_moderators_in_rooms()
    {
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/3/pin', 2)[0], 'Someone else\'s conversation');
        $this->assertSame(403, $this->call('POST', '/api/parley/messages/4/pin', 2)[0], 'A member in a room');

        [$status, $body] = $this->call('POST', '/api/parley/messages/2/pin', 2);
        $this->assertSame(200, $status);
        $this->assertTrue($body['message']['pinned']);

        [, $details] = $this->call('GET', '/api/parley/conversations/1/details', 3, [], ['tab' => 'pins']);
        $this->assertSame([2], array_column($details['items'], 'id'));
        $this->assertSame([2, 3], array_map('intval', array_column($details['members'], 'id')));

        [, $links] = $this->call('GET', '/api/parley/conversations/1/details', 3, [], ['tab' => 'links']);
        $this->assertSame([2], array_column($links['items'], 'id'));

        $this->call('POST', '/api/parley/messages/2/pin', 3, ['on' => false]);
        $this->assertSame(0, $this->database()->table('parley_pins')->count());
    }

    #[Test]
    public function forwarding_needs_the_message_and_every_target_to_be_yours()
    {
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/3/forward', 2, ['conversationIds' => [1]])[0], 'A message you cannot see');
        $this->assertSame(404, $this->call('POST', '/api/parley/messages/1/forward', 2, ['conversationIds' => [1, 2]])[0], 'A conversation you are not in');
        $this->assertSame(1, $this->database()->table('parley_messages')->where('conversation_id', 1)->where('body', 'Hello there')->count(), 'All or nothing');

        $this->assertSame(422, $this->call('POST', '/api/parley/messages/1/forward', 2, ['conversationIds' => []])[0]);

        [$status, $body] = $this->call('POST', '/api/parley/messages/2/forward', 2, ['conversationIds' => [1, 20]]);
        $this->assertSame(200, $status);
        $this->assertTrue($body['messages'][0]['meta']['forwarded']);
        $this->assertSame(20, $body['messages'][1]['conversationId']);
    }

    // ── Search ──────────────────────────────────────────────────────────────

    #[Test]
    public function search_only_ever_looks_in_conversations_you_may_read()
    {
        $found = fn (int $actor, array $q) => array_column($this->call('GET', '/api/parley/search', $actor, [], $q)[1]['messages'], 'id');

        // 2 is still listed in the staff room but can no longer see it.
        $this->assertSame([4], $found(2, ['q' => 'banana']));
        $this->assertSame([3], $found(4, ['q' => 'banana']), 'A room you have not joined is not searched');
        $this->assertSame([], $found(2, ['q' => 'b']), 'Too short to search');
        $this->assertSame(404, $this->call('GET', '/api/parley/search', 2, [], ['q' => 'banana', 'conversation' => 2])[0]);
        $this->assertSame([2], $found(2, ['type' => 'link']));
        $this->assertSame([2], $found(2, ['from' => 3, 'q' => 'back']));
        $this->assertSame([], $found(2, ['q' => 'Hello', 'since' => Carbon::now()->addDays(2)->toDateString()]));
        $this->assertSame([], $found(2, ['q' => '%%', 'conversation' => 1]), 'Wildcards are literal');
    }

    // ── Files ───────────────────────────────────────────────────────────────

    #[Test]
    public function files_are_sniffed_and_only_safe_types_are_kept()
    {
        $this->assertSame(422, $this->upload(2, 1, '<html><script>alert(1)</script></html>', 'notes.txt', 'file')[0], 'HTML calling itself text');
        $this->assertSame(422, $this->upload(2, 1, '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'logo.png', 'image')[0], 'SVG calling itself a picture');
        $this->assertSame(422, $this->upload(2, 1, "\x7FELF\x02\x01\x01".str_repeat("\0", 64), 'tool.pdf', 'file')[0], 'A program');
        $this->assertSame(422, $this->upload(2, 1, 'OggS', 'note.webm', 'voice', ['seconds' => 99999])[0], 'A voice note past the length cap');

        [$status, $body] = $this->upload(2, 1, "Meeting notes\nline two\n", '../../evil<name>.txt', 'file');
        $this->assertSame(200, $status);
        $this->assertSame('file', $body['message']['type']);
        $this->assertSame('evilname.txt', $body['message']['meta']['name']);

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
        [$status, $body] = $this->upload(2, 1, $png, 'dot.bin', 'file');
        $this->assertSame('image', $body['message']['type'], 'A picture sent as a file shows as a picture');
    }

    #[Test]
    public function a_file_is_served_only_to_people_who_may_read_it_and_never_runs()
    {
        [, $body] = $this->upload(2, 1, "plain words\n", 'notes.txt', 'file');
        $id = $body['message']['id'];

        $this->assertSame(404, $this->call('GET', "/api/parley/files/$id", 4)[0], 'Not even a moderator');
        $this->assertSame(404, $this->call('GET', "/api/parley/files/$id", 9)[0]);
        $this->assertSame(401, $this->call('GET', "/api/parley/files/$id", null)[0]);

        [$status, , $response] = $this->call('GET', "/api/parley/files/$id", 3);
        $this->assertSame(200, $status);
        $this->assertStringStartsWith('attachment', $response->getHeaderLine('Content-Disposition'));
        $this->assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        $this->assertStringContainsString('sandbox', $response->getHeaderLine('Content-Security-Policy'));
        $this->assertStringStartsWith('text/plain', $response->getHeaderLine('Content-Type'));

        $response = $this->send($this->request('GET', "/api/parley/files/$id", ['authenticatedAs' => 3])->withHeader('Range', 'bytes=0-4'));
        $this->assertSame(206, $response->getStatusCode());
        $this->assertSame('plain', (string) $response->getBody());

        $this->call('DELETE', "/api/parley/messages/$id", 2);
        $this->assertSame(404, $this->call('GET', "/api/parley/files/$id", 3)[0], 'Gone with its message');
    }

    #[Test]
    public function a_retried_send_does_not_post_twice()
    {
        $send = fn () => $this->call('POST', '/api/parley/conversations/1/messages', 2, ['body' => 'Once only', 'nonce' => 'abc123def456'])[1]['message']['id'];

        $this->assertSame($send(), $send());
        $this->assertSame(1, $this->database()->table('parley_messages')->where('body', 'Once only')->count());
    }

    #[Test]
    public function a_search_result_opens_in_its_place()
    {
        [$status, $body] = $this->call('GET', '/api/parley/conversations/1', 2, [], ['around' => 2]);
        $this->assertSame(200, $status);
        $this->assertSame([1, 2], array_column($body['messages'], 'id'));
    }

    #[Test]
    public function someone_who_appears_offline_is_never_shown_online()
    {
        $id = $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 10]])[1]['conversation']['id'];
        $this->call('POST', '/api/parley/heartbeat', 3, ['status' => 'invisible', 'place' => 'index']);
        $this->call('POST', '/api/parley/heartbeat', 10, ['status' => 'online', 'place' => 'index']);

        $online = fn (array $people) => array_column($people, 'online', 'username');

        [, $list] = $this->call('GET', '/api/parley/conversations', 2);
        $one = collect($list['conversations'])->firstWhere('id', 1);
        $this->assertFalse($online($one['participants'])['other'], 'In the conversation list');

        [, $details] = $this->call('GET', "/api/parley/conversations/$id/details", 2, [], ['tab' => 'members']);
        $this->assertFalse($online($details['members'])['other'], 'In a group\'s member list');
        $this->assertTrue($online($details['members'])['member10'], 'Someone online still is');

        [, $people] = $this->call('GET', '/api/parley/people', 2, [], ['q' => 'oth']);
        $this->assertFalse($online($people['people'])['other'], 'In people search');
    }

    #[Test]
    public function a_photo_loses_its_camera_data_and_location()
    {
        $img = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($img);
        $jpeg = (string) ob_get_clean();
        // An APP1 Exif block, as a phone writes one, straight after the start marker.
        $exif = "Exif\0\0".str_pad('GPSLatitude 51.5074 N', 40, ' ');
        $jpeg = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
        $this->assertStringContainsString('GPSLatitude', $jpeg);

        [$status, $body] = $this->upload(2, 1, $jpeg, 'holiday.jpg', 'image');
        $this->assertSame(200, $status);
        $this->assertSame([40, 30], [$body['message']['meta']['w'], $body['message']['meta']['h']]);

        $response = $this->send($this->request('GET', '/api/parley/files/'.$body['message']['id'], ['authenticatedAs' => 3]));
        $served = (string) $response->getBody();
        $this->assertStringStartsWith("\xFF\xD8", $served, 'Still a JPEG');
        $this->assertStringNotContainsString('GPSLatitude', $served);
        $this->assertStringNotContainsString("Exif\0\0", $served);
    }
}
