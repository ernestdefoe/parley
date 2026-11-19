<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Ernestdefoe\Parley\Broadcaster;
use Ernestdefoe\Parley\ImageBytes;
use Ernestdefoe\Parley\Images;
use Ernestdefoe\Parley\Job\PushRealtime;
use Ernestdefoe\Parley\Realtime\Channel;
use Ernestdefoe\Parley\Realtime\NoChannel;
use Ernestdefoe\Parley\RoomRegistry;
use Ernestdefoe\Parley\Rooms;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Queue\Queue;
use Laminas\Diactoros\StreamFactory;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\Attributes\Test;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * Pictures checked for size before decoding, the legacy upload route gone,
 * a deleted room's files removed, the room registry, grouped counts on a
 * prefixed database, the has_link backfill, and pushes sent from the queue.
 *
 * Users: 1 admin · 2 normal · 3 other. Conversation 1: 2 and 3. Rooms 20, 21.
 */
class RoomsUploadsAndPushesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $room = fn (int $id) => ['id' => $id, 'type' => 'room', 'name' => "Room $id", 'slug' => "room-$id", 'is_group' => true, 'position' => $id, 'created_at' => $now, 'updated_at' => $now];

        $this->prepareDatabase([
            User::class => [$this->normalUser(), ['id' => 3, 'username' => 'other', 'email' => 'other@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now]],
            'parley_conversations' => [
                ['id' => 1, 'type' => 'direct', 'pair_key' => '2:3', 'creator_id' => 2, 'created_at' => $now, 'updated_at' => $now],
                $room(20), $room(21),
            ],
            'parley_participants' => [
                ['conversation_id' => 1, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 1, 'user_id' => 3, 'joined_at' => $now],
                ['conversation_id' => 20, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 20, 'user_id' => 3, 'joined_at' => $now],
            ],
            'parley_presence' => [
                ['visitor_key' => 'u2', 'user_id' => 2, 'status' => 'online', 'last_seen_at' => $now],
                ['visitor_key' => 'u3', 'user_id' => 3, 'status' => 'invisible', 'last_seen_at' => $now],
            ],
        ]);
    }

    /** A PNG header claiming 20 000 × 20 000 pixels: 400 MP, 1.6 GB to decode, 60 bytes to send. */
    private function bomb(): string
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n".$chunk('IHDR', pack('NNCCCCC', 20000, 20000, 8, 6, 0, 0, 0)).$chunk('IDAT', '').$chunk('IEND', '');
    }

    private function png(int $w = 40, int $h = 30): string
    {
        $img = imagecreatetruecolor($w, $h);
        ob_start();
        imagepng($img);

        return (string) ob_get_clean();
    }

    private function file(string $bytes, string $name): UploadedFile
    {
        return new UploadedFile((new StreamFactory())->createStream($bytes), strlen($bytes), UPLOAD_ERR_OK, $name, 'application/octet-stream');
    }

    #[Test]
    public function a_picture_with_too_many_pixels_is_refused_before_it_is_decoded()
    {
        $this->assertSame([20000, 20000], array_slice(getimagesizefromstring($this->bomb()), 0, 2), 'The header is a valid PNG header');
        $this->assertNull(ImageBytes::size($this->bomb()));
        $this->assertSame([40, 30], ImageBytes::size($this->png()));

        $sent = $this->send(
            $this->request('POST', '/api/parley/conversations/1/files', ['authenticatedAs' => 2])
                ->withUploadedFiles(['file' => $this->file($this->bomb(), 'big.png')])
                ->withParsedBody(['kind' => 'image'])
        );
        $this->assertSame(422, $sent->getStatusCode(), (string) $sent->getBody());

        $logo = $this->send(
            $this->request('POST', '/api/parley/admin/rooms/20/image', ['authenticatedAs' => 1])
                ->withUploadedFiles(['image' => $this->file($this->bomb(), 'big.png')])
        );
        $this->assertSame(422, $logo->getStatusCode(), (string) $logo->getBody());
        $this->assertStringContainsString('room_image_type', (string) $logo->getBody());

        $group = json_decode((string) $this->send($this->request('POST', '/api/parley/groups', ['authenticatedAs' => 2, 'json' => ['userIds' => [3, 1], 'name' => 'Crew']]))->getBody(), true);
        $photo = $this->send(
            $this->request('POST', '/api/parley/conversations/'.$group['conversation']['id'].'/photo', ['authenticatedAs' => 2])
                ->withUploadedFiles(['photo' => $this->file($this->bomb(), 'big.png')])
        );
        $this->assertSame(422, $photo->getStatusCode(), (string) $photo->getBody());
    }

    #[Test]
    public function the_legacy_image_routes_are_gone()
    {
        $upload = $this->send(
            $this->request('POST', '/api/parley/conversations/1/images', ['authenticatedAs' => 2])
                ->withUploadedFiles(['image' => $this->file($this->png(), 'a.png')])
        );
        $this->assertSame(404, $upload->getStatusCode());
        $this->assertSame(404, $this->send($this->request('GET', '/api/parley/images/1', ['authenticatedAs' => 2]))->getStatusCode());
    }

    #[Test]
    public function deleting_a_room_deletes_the_files_only_it_uses()
    {
        $disk = $this->app()->getContainer()->make(Factory::class)->disk(Images::DISK);
        $path = fn (string $c) => '2026/11/'.str_repeat($c, 32).'.png';
        foreach (['a', 'b', 'c'] as $c) {
            $disk->put($path($c), 'x');
        }

        $now = Carbon::now();
        $message = fn (int $id, int $conversation, string $file, bool $forwarded = false) => [
            'id' => $id, 'conversation_id' => $conversation, 'user_id' => 2, 'type' => 'image', 'created_at' => $now,
            'meta' => json_encode(['file' => $file, 'mime' => 'image/png', 'size' => 1] + ($forwarded ? ['forwarded' => true] : [])),
        ];
        $this->database()->table('parley_messages')->insert([
            $message(1, 1, $path('c')),           // c sent in the direct conversation…
            $message(2, 20, $path('a')),          // a sent in the room, only there
            $message(3, 20, $path('b')),          // b sent in the room…
            $message(4, 20, $path('c'), true),    // …c forwarded into the room
            $message(5, 1, $path('b'), true),     // …b forwarded out of it
        ]);

        $response = $this->send($this->request('DELETE', '/api/parley/admin/rooms/20', ['authenticatedAs' => 1]));
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());

        $this->assertFalse($disk->exists($path('a')), 'Used only by the room: deleted');
        $this->assertTrue($disk->exists($path('b')), 'Forwarded elsewhere: kept');
        $this->assertTrue($disk->exists($path('c')), 'Forwarded in from elsewhere: kept');
    }

    #[Test]
    public function card_extenders_and_owners_come_from_the_registry_and_the_deprecated_statics()
    {
        $container = $this->app()->getContainer();
        $registry = $container->make(RoomRegistry::class);
        $this->assertSame($registry, $container->make(RoomRegistry::class), 'One registry per container');

        $registry->addCardExtender(fn (array $cards) => array_map(fn ($c) => $c + ['fromRegistry' => true], $cards));
        Rooms::$cardExtenders[] = fn (array $cards) => array_map(fn ($c) => $c + ['fromStatic' => true], $cards);

        try {
            $response = $this->send($this->request('GET', '/api/parley/rooms', ['authenticatedAs' => 2]));
            $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
            $rooms = array_column(json_decode((string) $response->getBody(), true)['rooms'], null, 'id');
            $this->assertTrue($rooms[20]['fromRegistry']);
            $this->assertTrue($rooms[20]['fromStatic']);

            // Grouped counts (Counts::by) on the prefixed test database.
            $this->assertSame(2, $rooms[20]['members']);
            $this->assertSame(1, $rooms[20]['online'], 'Appear offline is not counted');
            $this->assertSame(0, $rooms[21]['members']);

            $this->database()->table('parley_conversations')->where('id', 21)->update(['owner' => 'voice']);
            $rooms = $container->make(Rooms::class);
            $owned = $rooms->find(21);
            $actor = User::find(2);
            $this->assertFalse($rooms->canView($owned, $actor), 'No owner registered: closed');
            $registry->addOwner('voice', fn (object $room, User $u) => $u->id === 2);
            $this->assertTrue($rooms->canView($owned, $actor));
        } finally {
            Rooms::$cardExtenders = [];
        }
    }

    #[Test]
    public function has_link_is_backfilled_for_existing_messages()
    {
        $db = $this->database();
        $now = Carbon::now();
        $rows = [];
        foreach ([1 => 'see https://example.com', 2 => 'plain words', 3 => 'old HTTP://example.org', 4 => null] as $id => $body) {
            $rows[] = ['id' => $id, 'conversation_id' => 1, 'user_id' => 2, 'type' => 'text', 'body' => $body, 'created_at' => $now];
        }
        $db->table('parley_messages')->insert($rows);

        // The migration's backfill, without its ALTER TABLE: MySQL would
        // commit the test's transaction at any DDL.
        \Ernestdefoe\Parley\MessageLinks::backfill($db);

        $this->assertSame([1 => 1, 2 => 0, 3 => 1, 4 => 0], $db->table('parley_messages')->orderBy('id')->pluck('has_link', 'id')->map(fn ($v) => (int) $v)->all());
    }

    #[Test]
    public function pushes_go_through_the_queue_and_a_failing_daemon_is_only_logged()
    {
        $this->assertInstanceOf(NoChannel::class, $this->app()->getContainer()->make(Channel::class), 'No flarum/realtime: NoChannel');
        $this->assertFalse($this->app()->getContainer()->make(Broadcaster::class)->available());

        $channel = new class implements Channel
        {
            public array $triggered = [];

            public bool $fail = false;

            public function available(): bool
            {
                return true;
            }

            public function trigger(array|string $channels, string $event, array $payload): void
            {
                if ($this->fail) {
                    throw new RuntimeException('daemon down');
                }
                $this->triggered[] = [$channels, $event];
            }
        };

        $queue = $this->createStub(Queue::class);
        $pushed = [];
        $queue->method('push')->willReturnCallback(function ($job) use (&$pushed) {
            $pushed[] = $job;

            return null;
        });

        $broadcaster = new Broadcaster($channel, $queue);
        $broadcaster->toUsers(range(1, 150), 'message', ['id' => 1]);
        $broadcaster->toEveryone('presence');
        $this->assertSame([], $channel->triggered, 'Nothing is sent inside the request');
        $this->assertCount(2, $pushed);
        $this->assertInstanceOf(PushRealtime::class, $pushed[0]);
        $this->assertCount(2, $pushed[0]->batches, '100 channels per trigger');

        $log = $this->createMock(LoggerInterface::class);
        $log->expects($this->never())->method('warning');
        $pushed[0]->handle($channel, $log);
        $this->assertCount(2, $channel->triggered);
        $this->assertSame('private-user=1', $channel->triggered[0][0][0]);
        $this->assertSame('parley.message', $channel->triggered[0][1]);

        $channel->fail = true;
        $log = $this->createMock(LoggerInterface::class);
        $log->expects($this->once())->method('warning');
        $pushed[1]->handle($channel, $log);

        // Through the container with the sync queue: a send still succeeds
        // when the daemon is down.
        $this->app()->getContainer()->instance(Channel::class, $channel);
        $sent = $this->send($this->request('POST', '/api/parley/conversations/1/messages', ['authenticatedAs' => 2, 'json' => ['body' => 'hello']]));
        $this->assertSame(200, $sent->getStatusCode(), (string) $sent->getBody());
    }
}
