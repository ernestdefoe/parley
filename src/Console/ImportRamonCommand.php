<?php

namespace Ernestdefoe\Parley\Console;

use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
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

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings
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
        $schema = $this->db->getSchemaBuilder();
        if (! $schema->hasTable('chat_channels')) {
            $this->info('ramon/chat tables were not found. Nothing to import.');

            return 0;
        }

        $dry = (bool) $this->input->getOption('dry-run');
        $done = array_flip(json_decode((string) $this->settings->get(self::DONE), true) ?: []);

        $direct = $this->db->table('chat_channels')->where('type', 'direct')->whereNull('deleted_at')->get();
        $tagChannels = $this->db->table('chat_channels')->where('type', '!=', 'direct')->whereNull('deleted_at')->orderBy('id')->get();
        $rooms = 0;
        $roomMessages = 0;

        $conversations = 0;
        $messages = 0;

        foreach ($direct as $channel) {
            if (isset($done[(int) $channel->id])) {
                continue;
            }

            $members = $this->db->table('chat_channel_user')->where('channel_id', $channel->id)->get();
            $rows = $this->db->table('chat_messages')->where('channel_id', $channel->id)
                ->whereNull('thread_id')->whereNull('deleted_at')->orderBy('id')->get();

            if ($members->count() < 2 || $rows->isEmpty()) {
                continue;
            }

            $conversations++;
            $messages += $rows->count();

            if ($dry) {
                continue;
            }

            $this->db->transaction(function () use ($channel, $members, $rows, &$done) {
                $userIds = $members->pluck('user_id')->map(fn ($id) => (int) $id)->sort()->values();
                $isGroup = $userIds->count() > 2;
                $pairKey = $isGroup ? null : $userIds[0].':'.$userIds[1];

                $existing = $pairKey ? $this->db->table('parley_conversations')->where('pair_key', $pairKey)->value('id') : null;
                $conversationId = $existing ?: $this->db->table('parley_conversations')->insertGetId([
                    'is_group' => $isGroup,
                    'title' => $isGroup ? ($channel->name ?: null) : null,
                    'creator_id' => $channel->creator_id,
                    'pair_key' => $pairKey,
                    'created_at' => $channel->created_at,
                    'updated_at' => $channel->updated_at,
                ]);

                $map = [];
                foreach ($rows as $row) {
                    $map[(int) $row->id] = $this->db->table('parley_messages')->insertGetId([
                        'conversation_id' => $conversationId,
                        'user_id' => $row->user_id,
                        'type' => 'text',
                        'body' => $this->plain((string) $row->content),
                        'reply_to_id' => $row->reply_to_id ? ($map[(int) $row->reply_to_id] ?? null) : null,
                        'created_at' => $row->created_at,
                        'edited_at' => $row->edited_at,
                    ]);
                }

                $lastId = end($map);
                $this->db->table('parley_conversations')->where('id', $conversationId)
                    ->update(['last_message_id' => $lastId, 'last_message_at' => $rows->last()->created_at]);

                foreach ($members as $member) {
                    $lastRead = $member->last_read_message_id ? ($map[(int) $member->last_read_message_id] ?? null) : null;
                    $this->db->table('parley_participants')->updateOrInsert(
                        ['conversation_id' => $conversationId, 'user_id' => $member->user_id],
                        ['last_read_message_id' => $lastRead, 'muted' => (bool) $member->muted, 'joined_at' => $member->joined_at ?: $channel->created_at]
                    );
                }

                $done[(int) $channel->id] = true;
                $this->settings->set(self::DONE, json_encode(array_keys($done)));
            });
        }

        $this->info(sprintf(
            '%s %d conversation(s), %d message(s).',
            $dry ? 'Would import' : 'Imported',
            $conversations,
            $messages
        ));
        foreach ($tagChannels as $channel) {
            if (isset($done['c'.$channel->id])) {
                continue;
            }

            $rows = $this->db->table('chat_messages')->where('channel_id', $channel->id)
                ->whereNull('thread_id')->whereNull('deleted_at')->orderBy('id')->get();
            $members = $this->db->table('chat_channel_user')->where('channel_id', $channel->id)->get();

            $rooms++;
            $roomMessages += $rows->count();

            if ($dry) {
                continue;
            }

            $this->db->transaction(function () use ($channel, $rows, $members, &$done) {
                $slug = \Illuminate\Support\Str::slug((string) ($channel->slug ?: $channel->name)) ?: 'room';
                for ($base = $slug, $i = 2; $this->db->table('parley_conversations')->where('slug', $slug)->exists(); $i++) {
                    $slug = $base.'-'.$i;
                }

                $roomId = $this->db->table('parley_conversations')->insertGetId([
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

                $map = [];
                foreach ($rows as $row) {
                    $map[(int) $row->id] = $this->db->table('parley_messages')->insertGetId([
                        'conversation_id' => $roomId,
                        'user_id' => $row->user_id,
                        'type' => 'text',
                        'body' => $this->plain((string) $row->content),
                        'reply_to_id' => $row->reply_to_id ? ($map[(int) $row->reply_to_id] ?? null) : null,
                        'created_at' => $row->created_at,
                        'edited_at' => $row->edited_at,
                    ]);
                }

                if ($map) {
                    $this->db->table('parley_conversations')->where('id', $roomId)
                        ->update(['last_message_id' => end($map), 'last_message_at' => $rows->last()->created_at]);
                }

                foreach ($members as $member) {
                    $this->db->table('parley_participants')->updateOrInsert(
                        ['conversation_id' => $roomId, 'user_id' => $member->user_id],
                        ['last_read_message_id' => $map ? end($map) : null, 'muted' => (bool) $member->muted, 'joined_at' => $member->joined_at ?: $channel->created_at]
                    );
                }

                $done['c'.$channel->id] = true;
                $this->settings->set(self::DONE, json_encode(array_keys($done)));
            });
        }

        $this->info(sprintf(
            '%s %d room(s) from tag channels, %d message(s).',
            $dry ? 'Would import' : 'Imported',
            $rooms,
            $roomMessages
        ));

        return 0;
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
