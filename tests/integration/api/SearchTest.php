<?php

namespace Ernestdefoe\Parley\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * Search reaches only what the searcher may read, without listing every
 * conversation they are in, and the Links filter and tab read has_link.
 *
 * User 2 is in: direct 1 (with 3), group 3, room 20 (open) and room 21
 * (tied to a tag nobody can see here: a room they lost). User 2 is not in
 * direct 2 or room 22, which is open.
 */
class SearchTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $now = Carbon::now();
        $user = fn (int $id, string $name) => ['id' => $id, 'username' => $name, 'email' => "$name@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => 1, 'joined_at' => $now];
        $conversation = fn (int $id, array $extra) => $extra + ['id' => $id, 'type' => 'direct', 'is_group' => false, 'created_at' => $now, 'updated_at' => $now];
        $room = fn (int $id, string $slug, array $extra = []) => $conversation($id, $extra + ['type' => 'room', 'is_group' => true, 'name' => $slug, 'slug' => $slug]);
        $in = fn (int $conversation, int $user) => ['conversation_id' => $conversation, 'user_id' => $user, 'joined_at' => $now];
        $message = fn (int $id, int $conversation, string $body, bool $link = false) => ['id' => $id, 'conversation_id' => $conversation, 'user_id' => 3, 'type' => 'text', 'body' => $body, 'has_link' => $link, 'created_at' => $now->copy()->addSeconds($id)];

        $this->prepareDatabase([
            User::class => [$this->normalUser(), $user(3, 'other'), $user(4, 'third')],
            'parley_conversations' => [
                $conversation(1, ['pair_key' => '2:3']),
                $conversation(2, ['pair_key' => '3:4']),
                $conversation(3, ['is_group' => true, 'title' => 'Crew']),
                $room(20, 'lobby'),
                $room(21, 'staff-room', ['tag_id' => 1]),
                $room(22, 'elsewhere'),
            ],
            'parley_participants' => [
                $in(1, 2), $in(1, 3), $in(2, 3), $in(2, 4), $in(3, 2), $in(3, 3), $in(3, 4),
                $in(20, 2), $in(20, 3), $in(21, 2), $in(21, 3), $in(22, 3),
            ],
            'parley_messages' => [
                $message(1, 1, 'Banana in the direct one'),
                $message(2, 2, 'Banana between 3 and 4'),
                $message(3, 3, 'Banana for the crew'),
                $message(4, 20, 'Banana in the lobby'),
                $message(5, 21, 'Banana in the lost room'),
                $message(6, 22, 'Banana in a room 2 never joined'),
                $message(7, 1, 'Recipe at https://example.com/bread', true),
                // Says "http" but was never marked: has_link decides, not the text.
                $message(8, 1, 'The http:// prefix is old news'),
                $message(9, 21, 'Lost room link https://example.com', true),
            ],
        ]);
    }

    private function search(int $actor, array $query): array
    {
        $response = $this->send($this->request('GET', '/api/parley/search', ['authenticatedAs' => $actor])->withQueryParams($query));

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    #[Test]
    public function only_your_own_conversations_and_rooms_you_can_still_read()
    {
        [$status, $body] = $this->search(2, ['q' => 'banana']);

        $this->assertSame(200, $status);
        $this->assertSame([4, 3, 1], array_column($body['messages'], 'id'), 'Not direct 2, not the lost room 21, not room 22');
        $this->assertEqualsCanonicalizing([1, 3, 20], array_map('intval', array_column($body['conversations'], 'id')));
    }

    #[Test]
    public function the_link_filter_and_the_links_tab_read_has_link()
    {
        $this->assertSame([7], array_column($this->search(2, ['type' => 'link'])[1]['messages'], 'id'), 'Not the lost room\'s link either');

        $response = $this->send($this->request('GET', '/api/parley/conversations/1/details', ['authenticatedAs' => 2])->withQueryParams(['tab' => 'links']));
        $this->assertSame([7], array_column(json_decode((string) $response->getBody(), true)['items'], 'id'));
    }

    #[Test]
    public function thirty_searches_a_minute()
    {
        for ($i = 0; $i < 30; $i++) {
            $this->assertSame(200, $this->search(2, ['q' => 'banana'])[0]);
        }

        $this->assertSame(429, $this->search(2, ['q' => 'banana'])[0]);
        $this->assertSame(200, $this->search(3, ['q' => 'banana'])[0], 'Counted per person');
    }
}
