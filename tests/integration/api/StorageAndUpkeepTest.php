<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Ernestdefoe\Parley\Images;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Contracts\Filesystem\Factory;
use Laminas\Diactoros\StreamFactory;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\Attributes\Test;

/**
 * Where Parley keeps what is sent, and the upkeep it does: files on its own
 * disk, logos and group photos on the assets disk, rooms reordered in one
 * query, stale presence pruned by a queued job, not on every heartbeat.
 *
 * Users: 1 admin · 2 normal · 3 other · 4 member4. Conversation 1: 2 and 3.
 * Rooms 20, 21 and 22, in that order.
 */
class StorageAndUpkeepTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, string $name) => ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $room = fn (int $id, string $name, int $position) => ['id' => $id, 'type' => 'room', 'name' => $name, 'slug' => strtolower($name), 'is_group' => true, 'position' => $position, 'created_at' => $now, 'updated_at' => $now];

        $this->prepareDatabase([
            User::class => [$this->normalUser(), $user(3, 'other'), $user(4, 'member4')],
            'parley_conversations' => [
                ['id' => 1, 'type' => 'direct', 'pair_key' => '2:3', 'creator_id' => 2, 'created_at' => $now, 'updated_at' => $now],
                $room(20, 'Alpha', 0), $room(21, 'Beta', 1), $room(22, 'Gamma', 2),
            ],
            'parley_participants' => [
                ['conversation_id' => 1, 'user_id' => 2, 'joined_at' => $now],
                ['conversation_id' => 1, 'user_id' => 3, 'joined_at' => $now],
            ],
        ]);
    }

    private function png(int $w = 40, int $h = 30): string
    {
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, 200, 30, 30));
        ob_start();
        imagepng($img);

        return (string) ob_get_clean();
    }

    private function file(string $bytes, string $name): UploadedFile
    {
        return new UploadedFile((new StreamFactory())->createStream($bytes), strlen($bytes), UPLOAD_ERR_OK, $name, 'application/octet-stream');
    }

    private function disk(string $name)
    {
        return $this->app()->getContainer()->make(Factory::class)->disk($name);
    }

    #[Test]
    public function a_sent_file_is_kept_on_parleys_private_disk_and_served_from_it()
    {
        $bytes = "%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n";
        $response = $this->send(
            $this->request('POST', '/api/parley/conversations/1/files', ['authenticatedAs' => 2])
                ->withUploadedFiles(['file' => $this->file($bytes, 'notes.pdf')])
                ->withParsedBody(['kind' => 'file'])
        );
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
        $message = json_decode((string) $response->getBody(), true)['message'];

        $id = (int) $message['id'];
        $meta = json_decode((string) $this->database()->table('parley_messages')->where('id', $id)->value('meta'), true);
        $this->assertMatchesRegularExpression('~^\d{4}/\d{2}/[a-f0-9]{32}\.pdf$~', $meta['file']);
        $this->assertSame($bytes, $this->disk(Images::DISK)->get($meta['file']), 'The bytes are on the disk as sent');

        $served = $this->send($this->request('GET', "/api/parley/files/$id", ['authenticatedAs' => 3]));
        $this->assertSame(200, $served->getStatusCode());
        $this->assertSame($bytes, (string) $served->getBody());
        $this->assertSame((string) strlen($bytes), $served->getHeaderLine('Content-Length'));

        $ranged = $this->send($this->request('GET', "/api/parley/files/$id", ['authenticatedAs' => 3])->withHeader('Range', 'bytes=5-7'));
        $this->assertSame(206, $ranged->getStatusCode());
        $this->assertSame(substr($bytes, 5, 3), (string) $ranged->getBody());

        $this->disk(Images::DISK)->delete($meta['file']);
        $this->assertSame(404, $this->send($this->request('GET', "/api/parley/files/$id", ['authenticatedAs' => 3]))->getStatusCode(), 'Gone from the disk is a 404');
    }

    #[Test]
    public function a_room_logo_and_a_group_photo_go_to_the_assets_disk()
    {
        $logo = $this->send(
            $this->request('POST', '/api/parley/admin/rooms/20/image', ['authenticatedAs' => 1])
                ->withUploadedFiles(['image' => $this->file($this->png(), 'logo.png')])
        );
        $this->assertSame(200, $logo->getStatusCode(), (string) $logo->getBody());
        $path = (string) $this->database()->table('parley_conversations')->where('id', 20)->value('image_path');
        $this->assertMatchesRegularExpression('~^parley/rooms/20-[0-9a-f]{12}\.png$~', $path);
        $this->assertTrue($this->disk('flarum-assets')->exists($path));

        $notAPicture = $this->send(
            $this->request('POST', '/api/parley/admin/rooms/20/image', ['authenticatedAs' => 1])
                ->withUploadedFiles(['image' => $this->file('<svg onload="alert(1)"/>', 'logo.png')])
        );
        $this->assertSame(422, $notAPicture->getStatusCode());

        $group = json_decode((string) $this->send($this->request('POST', '/api/parley/groups', ['authenticatedAs' => 2, 'json' => ['userIds' => [3, 4], 'name' => 'Crew']]))->getBody(), true);
        $id = (int) $group['conversation']['id'];
        $photo = $this->send(
            $this->request('POST', "/api/parley/conversations/$id/photo", ['authenticatedAs' => 2])
                ->withUploadedFiles(['photo' => $this->file($this->png(300, 200), 'crew.png')])
        );
        $this->assertSame(200, $photo->getStatusCode(), (string) $photo->getBody());
        $stored = (string) $this->database()->table('parley_conversations')->where('id', $id)->value('image_path');
        $this->assertMatchesRegularExpression('~^parley/groups/[a-f0-9]{32}\.webp$~', $stored);
        $this->assertSame([256, 256], array_slice(getimagesizefromstring($this->disk('flarum-assets')->get($stored)), 0, 2));
    }

    #[Test]
    public function rooms_are_reordered_in_one_query()
    {
        $this->app();
        $db = $this->database();
        $db->enableQueryLog();
        $db->flushQueryLog();

        $response = $this->send($this->request('POST', '/api/parley/admin/rooms/order', ['authenticatedAs' => 1, 'json' => ['ids' => [22, 20, 21]]]));
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());

        $updates = array_filter($db->getQueryLog(), fn ($q) => str_starts_with(strtolower($q['query']), 'update') && str_contains($q['query'], 'parley_conversations'));
        $this->assertCount(1, $updates);
        $this->assertSame(
            [20 => 1, 21 => 2, 22 => 0],
            $db->table('parley_conversations')->whereIn('id', [20, 21, 22])->pluck('position', 'id')->map(fn ($p) => (int) $p)->sortKeys()->all()
        );
    }

    #[Test]
    public function stale_presence_is_pruned_at_most_once_per_window()
    {
        $stale = fn (string $key) => ['visitor_key' => $key, 'status' => 'online', 'place' => 'index', 'last_seen_at' => Carbon::now()->subHour()];
        $this->app();
        $this->database()->table('parley_presence')->insert($stale('gold'));

        $this->send($this->request('POST', '/api/parley/heartbeat', ['authenticatedAs' => 2, 'json' => ['status' => 'online', 'place' => 'index']]));
        $this->assertFalse($this->database()->table('parley_presence')->where('visitor_key', 'gold')->exists(), 'The first heartbeat queues a prune');

        $this->database()->table('parley_presence')->insert($stale('gold2'));
        $this->send($this->request('POST', '/api/parley/heartbeat', ['authenticatedAs' => 3, 'json' => ['status' => 'online', 'place' => 'index']]));
        $this->assertTrue($this->database()->table('parley_presence')->where('visitor_key', 'gold2')->exists(), 'Not again within ten minutes');
        $this->assertTrue($this->database()->table('parley_presence')->where('visitor_key', 'u3')->exists(), 'A fresh heartbeat stays');
    }
}
