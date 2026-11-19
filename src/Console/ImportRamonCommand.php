<?php

namespace Ernestdefoe\Parley\Console;

use Ernestdefoe\Parley\Rooms;
use Ernestdefoe\Parley\MessageLinks;
use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\Console\Input\InputOption;

/**
 * Bring conversations across from ramon/chat.
 *
 * Direct channels become one-to-one or group conversations. Tag channels
 * become Parley rooms tied to the same tag, so the same people can see them.
 * Safe to run twice: a channel already imported is skipped.
 */
class ImportRamonCommand extends AbstractCommand
{
    private const DONE = 'ernestdefoe-parley.ramon_imported';

    /** Channels read per query. */
    public const CHUNK = 100;

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected Rooms $rooms
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('parley:import-ramon')
            ->setDescription('Import direct and group messages from ramon/chat into Parley.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Count what would be imported and change nothing.');
    }

    protected function fire(): int
    {
        if (! $this->db->getSchemaBuilder()->hasTable('chat_channels')) {
            $this->info('ramon/chat tables were not found. Nothing to import.');

            return 0;
        }

        $dry = (bool) $this->input->getOption('dry-run');
        $done = array_flip(json_decode((string) $this->settings->get(self::DONE), true) ?: []);

        [$conversations, $messages] = $this->directChannels($dry, $done);
        $this->info(sprintf('%s %d conversation(s), %d message(s).', $dry ? 'Would import' : 'Imported', $conversations, $messages));

        [$rooms, $roomMessages] = $this->tagChannels($dry, $done);
        $this->info(sprintf('%s %d room(s) from tag channels, %d message(s).', $dry ? 'Would import' : 'Imported', $rooms, $roomMessages));

        return 0;
    }

    /**
     * Direct channels, CHUNK at a time: their members, and the conversations
     * already open between the same two people, come in one query per chunk.
     *
     * @param  array<int|string, mixed>  $done
     * @return array{int, int} conversations, messages
     */
    private function directChannels(bool $dry, array &$done): array
    {
        $count = [0, 0];
        $this->channels()->where('type', 'direct')->chunkById(self::CHUNK, function (Collection $channels) use ($dry, &$done, &$count) {
            $channels = $channels->reject(fn ($c) => isset($done[(int) $c->id]))->values();
            $members = $this->membersOf($channels);
            $pairs = $dry ? [] : $this->openPairs($members);

            foreach ($channels as $channel) {
                $who = $members->get($channel->id, collect());
                $rows = $who->count() < 2 ? collect() : $this->said($channel);
                if ($rows->isEmpty()) {
                    continue;
                }

                $count[0]++;
                $count[1] += $rows->count();
                if (! $dry) {
                    $this->db->transaction(function () use ($channel, $who, $rows, &$pairs, &$done) {
                        $this->importDirect($channel, $who, $rows, $pairs, $done);
                    });
                }
            }
        });

        return $count;
    }

    /**
     * Tag channels, CHUNK at a time, members in one query per chunk.
     *
     * @param  array<int|string, mixed>  $done
     * @return array{int, int} rooms, messages
     */
    private function tagChannels(bool $dry, array &$done): array
    {
        $count = [0, 0];
        $this->channels()->where('type', '!=', 'direct')->chunkById(self::CHUNK, function (Collection $channels) use ($dry, &$done, &$count) {
            $channels = $channels->reject(fn ($c) => isset($done['c'.$c->id]))->values();
            $members = $dry ? collect() : $this->membersOf($channels);

            foreach ($channels as $channel) {
                $rows = $this->said($channel);
                $count[0]++;
                $count[1] += $rows->count();
                if (! $dry) {
                    $who = $members->get($channel->id, collect());
                    $this->db->transaction(function () use ($channel, $who, $rows, &$done) {
                        $this->importRoom($channel, $who, $rows, $done);
                    });
                }
            }
        });

        return $count;
    }

    private function channels(): Builder
    {
        return $this->db->table('chat_channels')->whereNull('deleted_at');
    }

    /** @return Collection<int|string, Collection<int, object>> each channel's members, by channel id */
    private function membersOf(Collection $channels): Collection
    {
        return $channels->isEmpty() ? collect() : $this->db->table('chat_channel_user')
            ->whereIn('channel_id', $channels->pluck('id')->all())->get()->groupBy('channel_id');
    }

    /**
     * Conversations Parley already has between the two people of a channel.
     *
     * @param  Collection<int|string, Collection<int, object>>  $members
     * @return array<string, int> pair key => conversation id
     */
    private function openPairs(Collection $members): array
    {
        $keys = $members->map(fn ($who) => $this->pairKey($who))->filter()->values()->all();

        return $keys === [] ? [] : $this->db->table('parley_conversations')->whereIn('pair_key', $keys)
            ->pluck('id', 'pair_key')->map(fn ($id) => (int) $id)->all();
    }

    /** "2:3" for two people, null for a group. */
    private function pairKey(Collection $who): ?string
    {
        $ids = $who->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->sort()->values();

        return $ids->count() === 2 ? $ids[0].':'.$ids[1] : null;
    }

    /**
     * Only what people said: ramon/chat's system notices ("joined the
     * channel") have no author and no text, and would arrive as blank bubbles.
     * Read one channel at a time, so memory holds the largest channel's
     * history, never a whole chunk's.
     */
    private function said(object $channel): Collection
    {
        return $this->db->table('chat_messages')->where('channel_id', $channel->id)
            ->whereNull('thread_id')->whereNull('deleted_at')
            ->where('type', 'text')->whereNotNull('user_id')
            ->orderBy('id')->get()
            ->filter(fn ($row) => trim($this->plain((string) $row->content)) !== '')->values();
    }

    /**
     * @param  array<string, int>  $pairs  pair key => conversation id, kept up to date as this run opens them
     * @param  array<int|string, mixed>  $done
     */
    private function importDirect(object $channel, Collection $members, Collection $rows, array &$pairs, array &$done): void
    {
        $pairKey = $this->pairKey($members);
        $isGroup = $pairKey === null;

        $conversationId = $pairKey !== null ? ($pairs[$pairKey] ?? null) : null;
        $conversationId ??= (int) $this->db->table('parley_conversations')->insertGetId([
            'is_group' => $isGroup,
            'title' => $isGroup ? ($channel->name ?: null) : null,
            'creator_id' => $channel->creator_id,
            'pair_key' => $pairKey,
            'created_at' => $channel->created_at,
            'updated_at' => $channel->updated_at,
        ]);
        if ($pairKey !== null) {
            $pairs[$pairKey] = $conversationId;
        }

        $map = $this->copyMessages($conversationId, $rows);

        $this->join($conversationId, $members, $channel->created_at, fn ($member) => $member->last_read_message_id ? ($map[(int) $member->last_read_message_id] ?? null) : null);

        $this->markDone($done, (int) $channel->id);
    }

    /** @param  array<int|string, mixed>  $done */
    private function importRoom(object $channel, Collection $members, Collection $rows, array &$done): void
    {
        $slug = $this->rooms->uniqueSlug((string) ($channel->slug ?: $channel->name));

        $roomId = (int) $this->db->table('parley_conversations')->insertGetId([
            'type' => 'room',
            'is_group' => true,
            'name' => mb_substr((string) $channel->name, 0, 80) ?: 'Room',
            'slug' => $slug,
            'description' => $channel->description ? mb_substr((string) $channel->description, 0, 300) : null,
            'emoji' => $channel->emoji ? mb_substr((string) $channel->emoji, 0, 8) : null,
            // Same tag, same audience: whoever could see the channel
            // can see the room, and nobody else.
            'tag_id' => $channel->tag_id,
            'readonly' => ($channel->post_permission ?? 'all') === 'moderators',
            'position' => (int) $this->db->table('parley_conversations')->where('type', 'room')->max('position') + 1,
            'archived_at' => ($channel->status ?? 'open') === 'archived' ? ($channel->archived_at ?? date('Y-m-d H:i:s')) : null,
            'creator_id' => $channel->creator_id,
            'created_at' => $channel->created_at,
            'updated_at' => $channel->updated_at,
        ]);

        $map = $this->copyMessages($roomId, $rows);

        $last = $map ? end($map) : null;
        $this->join($roomId, $members, $channel->created_at, fn () => $last);

        $this->markDone($done, 'c'.$channel->id);
    }

    /**
     * One insert per message, in order: a reply points at the Parley id of the
     * message it answers, which exists only once that message is in.
     *
     * @return array<int, int> ramon/chat message id => Parley message id
     */
    private function copyMessages(int $conversationId, Collection $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $body = $this->plain((string) $row->content);
            $map[(int) $row->id] = (int) $this->db->table('parley_messages')->insertGetId([
                'conversation_id' => $conversationId,
                'user_id' => $row->user_id,
                'type' => 'text',
                'body' => $body,
                // Listed under Links, as a message sent in Parley would be.
                'has_link' => MessageLinks::has($body),
                'reply_to_id' => $row->reply_to_id ? ($map[(int) $row->reply_to_id] ?? null) : null,
                'created_at' => $row->created_at,
                'edited_at' => $row->edited_at,
            ]);
        }

        if ($map) {
            $this->db->table('parley_conversations')->where('id', $conversationId)
                ->update(['last_message_id' => end($map), 'last_message_at' => $rows->last()->created_at]);
        }

        return $map;
    }

    /**
     * Everyone in the channel, in one statement. A person listed twice is
     * written once, as their last row says; without a joined date they
     * joined when the channel opened.
     *
     * @param  Collection<int, \stdClass>  $members
     * @param  \Closure(\stdClass): (int|null)  $lastRead
     */
    private function join(int $conversationId, Collection $members, mixed $openedAt, \Closure $lastRead): void
    {
        $rows = $members->reverse()->unique('user_id')->map(fn ($member) => [
            'conversation_id' => $conversationId,
            'user_id' => $member->user_id,
            'last_read_message_id' => $lastRead($member),
            'muted' => (bool) $member->muted,
            'joined_at' => $member->joined_at ?: $openedAt,
        ])->values()->all();

        $this->db->table('parley_participants')->upsert($rows, ['conversation_id', 'user_id'], ['last_read_message_id', 'muted', 'joined_at']);
    }

    /** @param  array<int|string, mixed>  $done */
    private function markDone(array &$done, int|string $key): void
    {
        $done[$key] = true;
        $this->settings->set(self::DONE, json_encode(array_keys($done)));
    }

    /** ramon/chat stores formatter XML; Parley stores what was typed. */
    private function plain(string $content): string
    {
        if (! str_starts_with(ltrim($content), '<')) {
            return $content;
        }

        $text = preg_replace('~<(s|e)>.*?</\1>~s', '', $content);

        return trim(html_entity_decode(strip_tags((string) $text), ENT_QUOTES | ENT_HTML5));
    }
}
