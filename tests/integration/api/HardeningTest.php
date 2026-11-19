<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Ernestdefoe\Parley\Images;
use Ernestdefoe\Parley\Relations;
use Flarum\Extend;
use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\Attributes\Test;

/**
 * Alerts read on reading, case-insensitive mentions, hidden users kept
 * hidden, double taps, rate limits, files removed with their messages, and
 * lists built in bulk.
 *
 * Users: 1 admin · 2 normal · 3 other · 4 moderator · 5 BuckeyeBrian ·
 * 6 hidden (an extension hides them from everyone but themselves).
 * Conversation 1: 2 and 3, read by 2 up to message 1. Room 20: open.
 */
class HardeningTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const HIDDEN = 6;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        // Stands for any extension that hides people (a shadow ban, a private profile).
        $this->extend((new Extend\ModelVisibility(User::class))->scope(function (User $actor, $query) {
            if ($actor->id !== self::HIDDEN) {
                $query->where('users.id', '!=', self::HIDDEN);
            }
        }));

        $now = Carbon::now();
        $user = fn (int $id, string $name) => ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $message = fn (int $id, int $conversation, int $user, string $body) => ['id' => $id, 'conversation_id' => $conversation, 'user_id' => $user, 'type' => 'text', 'body' => $body, 'created_at' => $now->copy()->addSeconds($id)];

        $this->prepareDatabase([
            User::class => [$this->normalUser(), $user(3, 'other'), $user(4, 'moderator'), $user(5, 'BuckeyeBrian'), $user(self::HIDDEN, 'hidden')],
            'group_user' => [['user_id' => 4, 'group_id' => Group::MODERATOR_ID]],
            'parley_conversations' => [
                ['id' => 1, 'type' => 'direct', 'pair_key' => '2:3', 'creator_id' => 2, 'last_message_id' => 2, 'last_message_at' => $now->copy()->addSeconds(2), 'created_at' => $now, 'updated_at' => $now],
                ['id' => 20, 'type' => 'room', 'name' => 'Lobby', 'slug' => 'lobby', 'is_group' => true, 'created_at' => $now, 'updated_at' => $now],
            ],
            'parley_participants' => [
                ['conversation_id' => 1, 'user_id' => 2, 'joined_at' => $now, 'last_read_message_id' => 1],
                ['conversation_id' => 1, 'user_id' => 3, 'joined_at' => $now, 'last_read_message_id' => 2],
            ],
            'parley_messages' => [$message(1, 1, 2, 'Hello there'), $message(2, 1, 3, 'Hi back')],
        ]);
    }

    private function call(string $method, string $path, ?int $actor, array $body = []): array
    {
        $response = $this->send($this->request($method, $path, ($actor ? ['authenticatedAs' => $actor] : []) + ($body ? ['json' => $body] : [])));

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    private function upload(int $actor, int $conversation, string $bytes, string $name): array
    {
        $tmp = tempnam(sys_get_temp_dir(), 'pt');
        file_put_contents($tmp, $bytes);

        $request = $this->request('POST', "/api/parley/conversations/$conversation/files", ['authenticatedAs' => $actor])
            ->withUploadedFiles(['file' => new UploadedFile($tmp, strlen($bytes), UPLOAD_ERR_OK, $name, 'text/plain')])
            ->withParsedBody(['kind' => 'file']);
        $response = $this->send($request);

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    private function addUsers(int $from, int $count): array
    {
        $now = Carbon::now();
        $ids = range($from, $from + $count - 1);
        $this->database()->table('users')->insert(array_map(fn (int $id) => [
            'id' => $id, 'username' => "member$id", 'email' => "m$id@machine.local", 'password' => 'x', 'is_email_confirmed' => 1, 'joined_at' => $now,
        ], $ids));

        return $ids;
    }

    // ── Alerts ──────────────────────────────────────────────────────────────

    #[Test]
    public function reading_a_conversation_reads_its_alert_and_no_other()
    {
        $this->app();
        $alert = fn (int $conversation) => [
            'id' => $conversation, 'user_id' => 2, 'from_user_id' => 3, 'type' => 'parleyMessage', 'subject_id' => 3,
            'data' => json_encode(['conversationId' => $conversation]), 'created_at' => Carbon::now(),
        ];
        $this->database()->table('notifications')->insert([$alert(1), $alert(99)]);

        $this->assertSame(200, $this->call('POST', '/api/parley/conversations/1/read', 2, ['messageId' => 2])[0]);

        // By id: `data` is native JSON on MySQL and PostgreSQL, which is the point.
        $readAt = fn (int $conversation) => $this->database()->table('notifications')->where('id', $conversation)->value('read_at');
        $this->assertNotNull($readAt(1), 'Read with the conversation');
        $this->assertNull($readAt(99), 'Another conversation\'s alert stays unread');
    }

    #[Test]
    public function a_mention_finds_a_capitalised_username_however_it_is_typed()
    {
        $this->call('POST', '/api/parley/conversations/20/messages', 2, ['body' => 'Morning @buckeyebrian and @OTHER']);

        $mentions = fn (int $user) => $this->database()->table('notifications')->where('user_id', $user)->where('type', 'parleyRoomMention')->count();
        $this->assertSame(1, $mentions(5));
        $this->assertSame(1, $mentions(3));
    }

    // ── Visibility ──────────────────────────────────────────────────────────

    #[Test]
    public function someone_hidden_by_another_extension_is_neither_listed_nor_mentioned()
    {
        $this->call('POST', '/api/parley/heartbeat', self::HIDDEN, ['status' => 'online', 'place' => 'index']);
        $this->call('POST', '/api/parley/heartbeat', 3, ['status' => 'online', 'place' => 'index']);

        $online = array_map('intval', array_column($this->call('POST', '/api/parley/heartbeat', 2, ['status' => 'online'])[1]['online'], 'id'));
        $this->assertContains(3, $online);
        $this->assertNotContains(self::HIDDEN, $online);

        $this->call('POST', '/api/parley/conversations/20/messages', 2, ['body' => 'Hey @hidden']);
        $this->assertSame(0, $this->database()->table('notifications')->where('user_id', self::HIDDEN)->count());
    }

    // ── The online list ─────────────────────────────────────────────────────

    #[Test]
    public function a_crowded_online_list_reads_a_capped_page_and_counts_the_rest()
    {
        $this->app();
        $ids = $this->addUsers(100, 320);
        $now = time();
        $this->database()->table('parley_presence')->insert(array_map(fn (int $id) => [
            'visitor_key' => "u$id", 'user_id' => $id, 'status' => 'online', 'place' => 'index',
            // 100 is the longest here: outside the rows read, but followed.
            'last_seen_at' => date('Y-m-d H:i:s', $now - 60 + ($id - 100) % 50),
        ], $ids));
        $this->database()->table('parley_presence')->where('user_id', 101)->update(['status' => 'invisible']);
        $this->database()->table('parley_presence')->where('user_id', 100)->update(['last_seen_at' => date('Y-m-d H:i:s', $now - 80)]);
        $this->database()->table('parley_follows')->insert(['user_id' => 2, 'followed_id' => 100, 'created_at' => Carbon::now()]);

        [$status, $body] = $this->call('POST', '/api/parley/heartbeat', 2, ['status' => 'online']);
        $this->assertSame(200, $status);
        $this->assertCount(150, $body['online']);
        // 320 online, one appearing offline, plus 2 itself, less the 150 drawn.
        $this->assertSame(320 - 1 + 1 - 150 - 1, $body['more']);
        $this->assertNotContains(100, array_map('intval', array_column($body['followingOffline'], 'id')), 'Someone you follow is online however far down');
    }

    // ── Double taps ─────────────────────────────────────────────────────────

    #[Test]
    public function a_double_tap_on_follow_block_or_pin_is_not_an_error()
    {
        $relations = $this->app()->getContainer()->make(Relations::class);
        $relations->setFollow(2, 3, true);
        $relations->setFollow(2, 3, true);
        $relations->setBlock(4, 3, true);
        $relations->setBlock(4, 3, true);
        $this->assertSame(1, $this->database()->table('parley_follows')->where('user_id', 2)->count());
        $this->assertSame(1, $this->database()->table('parley_blocks')->where('user_id', 4)->count());

        $this->assertSame(200, $this->call('POST', '/api/parley/messages/2/pin', 2)[0]);
        $this->assertSame(200, $this->call('POST', '/api/parley/messages/2/pin', 2)[0]);
        $this->assertSame(1, $this->database()->table('parley_messages')->where('conversation_id', 1)->where('type', 'system')->count(), 'Said once');
    }

    // ── Rate limits ─────────────────────────────────────────────────────────

    #[Test]
    public function a_message_is_reported_once_and_reports_are_rate_limited()
    {
        $this->assertSame(200, $this->call('POST', '/api/parley/messages/2/report', 2, ['reason' => 'Rude'])[0]);
        $this->assertSame(422, $this->call('POST', '/api/parley/messages/2/report', 2, ['reason' => 'Still rude'])[0], 'Already open');
        $this->assertSame(1, $this->database()->table('parley_reports')->count());

        $this->database()->table('parley_messages')->insert(array_map(fn (int $id) => [
            'id' => $id, 'conversation_id' => 1, 'user_id' => 3, 'type' => 'text', 'body' => "Line $id", 'created_at' => Carbon::now(),
        ], range(10, 20)));
        $statuses = array_map(fn (int $id) => $this->call('POST', "/api/parley/messages/$id/report", 2)[0], range(10, 20));
        $this->assertSame(array_merge(array_fill(0, 9, 200), [429, 429]), $statuses, 'Ten an hour');
    }

    #[Test]
    public function opening_new_conversations_is_rate_limited()
    {
        $this->app();
        $ids = $this->addUsers(100, 31);

        $statuses = array_map(fn (int $id) => $this->call('POST', '/api/parley/conversations', 2, ['userId' => $id])[0], $ids);
        $this->assertSame(array_merge(array_fill(0, 30, 200), [429]), $statuses);
        $this->assertSame(200, $this->call('POST', '/api/parley/conversations', 2, ['userId' => 3])[0], 'One that exists still opens');
    }

    #[Test]
    public function the_eleventh_group_in_an_hour_is_refused()
    {
        $statuses = array_map(fn () => $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 5]])[0], range(1, 11));
        $this->assertSame(array_merge(array_fill(0, 10, 200), [422]), $statuses);
    }

    // ── Bulk checks ─────────────────────────────────────────────────────────

    #[Test]
    public function a_group_of_ten_is_checked_without_a_query_per_person()
    {
        $this->app();
        $ids = $this->addUsers(100, 10);
        $this->database()->table('parley_follows')->insert(['user_id' => 105, 'followed_id' => 2, 'created_at' => Carbon::now()]);

        // flarum/testing fails the request on a query repeated per person.
        [$status, $body] = $this->call('POST', '/api/parley/groups', 2, ['userIds' => $ids]);
        $this->assertSame(200, $status);
        $this->assertSame(11, $body['conversation']['memberCount']);

        $requested = $this->database()->table('parley_participants')->where('conversation_id', $body['conversation']['id'])
            ->whereNotNull('requested_at')->pluck('user_id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $this->assertSame(array_values(array_diff($ids, [105])), $requested, 'Everyone but the one who follows 2 gets a request');

        // The bulk check still refuses: someone who takes messages from nobody.
        $this->database()->table('users')->where('id', 107)->update(['preferences' => json_encode(['parleyWhoCanMessage' => 'nobody'])]);
        $this->assertSame(422, $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 107]])[0]);
        $this->database()->table('users')->where('id', 108)->update(['preferences' => json_encode(['parleyWhoCanMessage' => 'following'])]);
        $this->assertSame(422, $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 108]])[0], 'Follows only, and does not follow 2');
        $this->database()->table('users')->where('id', 105)->update(['preferences' => json_encode(['parleyWhoCanMessage' => 'following'])]);
        $this->assertSame(200, $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 105]])[0], 'Follows only, and follows 2');
    }

    // ── Files ───────────────────────────────────────────────────────────────

    #[Test]
    public function a_deleted_message_takes_its_file_unless_a_forward_still_shows_it()
    {
        $disk = $this->app()->getContainer()->make(Images::class)->disk();

        [, $body] = $this->upload(2, 1, "Meeting notes\n", 'notes.txt');
        $original = $body['message'];
        $file = $original['meta']['file'];
        $this->assertTrue($disk->exists($file));

        $forward = $this->call('POST', "/api/parley/messages/{$original['id']}/forward", 2, ['conversationIds' => [20]])[1]['messages'][0];

        $this->assertSame(200, $this->call('DELETE', "/api/parley/messages/{$original['id']}", 2)[0]);
        $this->assertTrue($disk->exists($file), 'The forward still shows it');

        $this->assertSame(200, $this->call('DELETE', "/api/parley/messages/{$forward['id']}", 2)[0]);
        $this->assertFalse($disk->exists($file), 'Nothing shows it any more');
    }

    #[Test]
    public function the_last_one_out_of_a_group_takes_its_files()
    {
        $disk = $this->app()->getContainer()->make(Images::class)->disk();
        $id = $this->call('POST', '/api/parley/groups', 2, ['userIds' => [3, 5]])[1]['conversation']['id'];
        $file = $this->upload(2, $id, "Plans\n", 'plans.txt')[1]['message']['meta']['file'];

        foreach ([3, 5] as $member) {
            $this->call('DELETE', "/api/parley/conversations/$id/members/$member", $member);
        }
        $this->assertTrue($disk->exists($file), 'Someone is still in it');

        $this->call('DELETE', "/api/parley/conversations/$id/members/2", 2);
        $this->assertSame(0, $this->database()->table('parley_conversations')->where('id', $id)->count());
        $this->assertFalse($disk->exists($file));
    }
}
