<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Ernestdefoe\Parley\Rooms;
use Ernestdefoe\Parley\Tags\TagVisibility;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * Who a tag-bound room's events are pushed to (Rooms::audience), worked out
 * in bulk by TagVisibility::whoCanSee() with flarum/tags' own rules.
 *
 * Groups: 4 (Mods) holds tag2.viewForum and tag4.viewForum.
 * Tags: 1 public · 2 restricted · 3 public child of 2 · 4 restricted child of 1
 *       · 5 restricted, nobody granted.
 * Users: 1 admin · 2 normal · 3 mod (group 4) · 4 unconfirmed · 10–29 members.
 */
class RoomAudienceTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, int $confirmed = 1) => ['id' => $id, 'username' => "u$id", 'email' => "u$id@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => $confirmed, 'joined_at' => $now];
        $room = fn (int $id, int $tag) => ['id' => $id, 'type' => 'room', 'name' => "Room $id", 'slug' => "room-$id", 'is_group' => true, 'tag_id' => $tag, 'created_at' => $now, 'updated_at' => $now];
        $tag = fn (int $id, bool $restricted, ?int $parent = null) => ['id' => $id, 'name' => "Tag $id", 'slug' => "tag-$id", 'is_restricted' => $restricted, 'parent_id' => $parent, 'position' => $id];

        $this->prepareDatabase([
            User::class => [$this->normalUser(), $user(3), $user(4, 0), ...array_map($user, range(10, 29))],
            'group_user' => [['user_id' => 3, 'group_id' => 4]],
            'group_permission' => [
                ['group_id' => 4, 'permission' => 'tag2.viewForum'],
                ['group_id' => 4, 'permission' => 'tag4.viewForum'],
            ],
            'tags' => [$tag(1, false), $tag(2, true), $tag(3, false, 2), $tag(4, true, 1), $tag(5, true)],
            'parley_conversations' => [$room(31, 1), $room(32, 2), $room(33, 3), $room(34, 4), $room(35, 5)],
        ]);
    }

    private function rooms(): Rooms
    {
        return $this->app()->getContainer()->make(Rooms::class);
    }

    #[Test]
    public function the_audience_is_exactly_who_flarum_tags_lets_see_the_tag()
    {
        $rooms = $this->rooms();

        $this->assertSame([1, 3], $rooms->audience($rooms->find(32), [1, 2, 3, 4]), 'A restricted tag: the admin and the mod, not the member');
        $this->assertSame([1], $rooms->audience($rooms->find(35), [1, 2, 3]), 'Granted to nobody: only the admin');

        // The same answer as Tag::whereVisibleTo() for each user and each tag.
        $users = User::query()->whereIn('id', [1, 2, 3, 4, 10])->with('groups')->orderBy('id')->get()->all();
        $tags = $this->app()->getContainer()->make(TagVisibility::class);
        foreach ([1, 2, 3, 4, 5] as $tagId) {
            $expected = array_values(array_map(fn (User $u) => (int) $u->id, array_filter($users, fn (User $u) => in_array($tagId, $tags->visibleIds($u), true))));
            $this->assertSame($expected, $tags->whoCanSee($tagId, $users), "Tag $tagId");
        }

        $this->assertSame([], $tags->whoCanSee(99, $users), 'A tag that does not exist is seen by nobody');
    }

    #[Test]
    public function the_audience_costs_the_same_queries_for_two_members_or_twenty()
    {
        $rooms = $this->rooms();
        $db = $this->database();
        $db->enableQueryLog();

        $count = function (int $roomId, array $ids) use ($rooms, $db): int {
            $db->flushQueryLog();
            $rooms->audience($rooms->find($roomId), $ids);

            return count($db->getQueryLog());
        };

        $few = $count(34, [10, 11]);
        $many = $count(34, range(10, 29));

        $this->assertSame($few, $many, 'No query per member');
        $this->assertLessThanOrEqual(6, $many);

        // Remembered: the same room and members ask nothing again.
        $db->flushQueryLog();
        $rooms->audience($rooms->find(34), range(10, 29));
        $this->assertCount(1, $db->getQueryLog(), 'Only the find() itself');
    }
}
