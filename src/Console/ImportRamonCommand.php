<?php

namespace Ernestdefoe\Parley\Console;

use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * Bring direct and group messages across from ramon/chat.
 *
 * Only `direct` channels come over. ramon/chat's tag channels are public rooms
 * with no Parley equivalent yet, so they are counted and reported, never
 * silently dropped. Safe to run twice: a channel already imported is skipped.
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
        $rooms = $this->db->table('chat_channels')->where('type', '!=', 'direct')->count();
        $roomMessages = $this->db->table('chat_messages as m')
            ->join('chat_channels as c', 'c.id', '=', 'm.channel_id')
            ->where('c.type', '!=', 'direct')->count();

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
        $this->info(sprintf(
            'Not imported: %d tag channel(s) holding %d message(s). Parley has no public rooms yet.',
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
