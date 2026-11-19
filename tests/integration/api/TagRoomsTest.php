<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * With flarum/tags enabled, its own rules decide who sees a room tied to a
 * tag (Tags\FlarumTags, bound through Extend\Conditional). Without it, the
 * same room is hidden from everyone (Parley2Test covers that side).
 *
 * Tag 1 is public, tag 2 is restricted with nobody granted it.
 * Room 30 is tied to tag 1, room 31 to tag 2.
 */
class TagRoomsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ernestdefoe-parley');

        $now = Carbon::now();
        $room = fn (int $id, string $name, int $tag) => ['id' => $id, 'type' => 'room', 'name' => $name, 'slug' => strtolower($name), 'is_group' => true, 'tag_id' => $tag, 'created_at' => $now, 'updated_at' => $now];

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            'tags' => [
                ['id' => 1, 'name' => 'General', 'slug' => 'general', 'icon' => 'fas fa-star', 'color' => '#123456', 'position' => 0],
                ['id' => 2, 'name' => 'Staff', 'slug' => 'staff', 'is_restricted' => true, 'position' => 1],
            ],
            'parley_conversations' => [$room(30, 'Open', 1), $room(31, 'Hidden', 2)],
        ]);
    }

    private function rooms(int $actor): array
    {
        $response = $this->send($this->request('GET', '/api/parley/rooms', ['authenticatedAs' => $actor]));
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());

        return array_column(json_decode((string) $response->getBody(), true)['rooms'], null, 'id');
    }

    #[Test]
    public function a_room_follows_its_tags_visibility_and_wears_its_badge()
    {
        $rooms = $this->rooms(2);
        $this->assertArrayHasKey(30, $rooms);
        $this->assertArrayNotHasKey(31, $rooms, 'A room under a tag you cannot see is invisible');
        $this->assertSame('fas fa-star', $rooms[30]['tagIcon']);
        $this->assertSame('#123456', $rooms[30]['tagColor']);

        $this->assertArrayHasKey(31, $this->rooms(1), 'The admin sees every tag');
    }
}
