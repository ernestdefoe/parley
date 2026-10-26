<?php

namespace Ernestdefoe\Parley\Console;

use Carbon\Carbon;
use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\GroupPhotos;
use Flarum\Console\AbstractCommand;
use Flarum\Foundation\Paths;
use Flarum\Formatter\Formatter;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * Bring group conversations across from ernestdefoe/group-messages.
 *
 * Each group dialog becomes a Parley group with the same name, photo, owner,
 * members, messages, replies and reactions, and each member keeps their place
 * (what they had read stays read).
 *
 * 🚨 Read-only on Group Messages' tables: nothing there is changed or
 * deleted, so its conversations stay exactly as they were. Every row brought
 * across is keyed to the one it came from, so running this again only adds
 * what is new — messages sent there since, people added since.
 */
class ImportGroupMessagesCommand extends AbstractCommand
{
    public function __construct(
        protected ConnectionInterface $db,
        protected Formatter $formatter,
        protected GroupPhotos $photos,
        protected Paths $paths
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('parley:import-group-messages')
            ->setDescription('Import group conversations from ernestdefoe/group-messages into Parley. Safe to run again.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Count what would be imported and change nothing.');
    }

    protected function fire(): int
    {
        $schema = $this->db->getSchemaBuilder();
        if (! $schema->hasTable('group_dialogs') || ! $schema->hasTable('dialog_messages')) {
            $this->info('Group Messages tables were not found. Nothing to import.');

            return 0;
        }

        $dry = (bool) $this->input->getOption('dry-run');
        $groups = $this->db->table('group_dialogs as g')->join('dialogs as d', 'd.id', '=', 'g.dialog_id')
            ->orderBy('g.dialog_id')->get(['g.*', 'd.created_at as dialog_created_at']);

        $made = 0;
        $added = 0;

        foreach ($groups as $group) {
            $members = $this->db->table('dialog_user')->where('dialog_id', $group->dialog_id)->get();
            $existing = $this->db->table('parley_conversations')->where('import_key', 'gm:'.$group->dialog_id)->first();
            $known = $existing ? array_flip($this->db->table('parley_messages')->where('conversation_id', $existing->id)
                ->whereNotNull('import_key')->pluck('import_key')->all()) : [];

            $rows = $this->db->table('dialog_messages')->where('dialog_id', $group->dialog_id)->orderBy('id')->get()
                ->reject(fn ($row) => isset($known['gmm:'.$row->id]))->values();

            if ($members->isEmpty() || (! $existing && $members->count() < 2)) {
                continue;
            }

            $made += $existing ? 0 : 1;
            $added += $rows->count();

            if ($dry) {
                continue;
            }

            $this->db->transaction(function () use ($group, $members, $rows, $existing) {
                $id = $existing ? (int) $existing->id : $this->db->table('parley_conversations')->insertGetId([
                    'type' => 'direct',
                    'is_group' => true,
                    'title' => $group->title ? mb_substr((string) $group->title, 0, 80) : null,
                    'creator_id' => $group->owner_id,
                    'import_key' => 'gm:'.$group->dialog_id,
                    'image_path' => $this->photo($group->icon_url),
                    'created_at' => $group->dialog_created_at ?? $group->created_at ?? Carbon::now(),
                    'updated_at' => Carbon::now(),
                ]);

                // Their message ids → ours, for replies and read places.
                $map = [];
                foreach ($this->db->table('parley_messages')->where('conversation_id', $id)->where('import_key', 'like', 'gmm:%')->get(['id', 'import_key']) as $m) {
                    $map[(int) substr($m->import_key, 4)] = (int) $m->id;
                }

                $replies = $rows->isEmpty() ? collect() : $this->db->table('dialog_message_replies')
                    ->whereIn('message_id', $rows->pluck('id')->all())->pluck('reply_to_id', 'message_id');

                foreach ($rows as $row) {
                    $body = $this->plain((string) $row->content);
                    if ($body === '') {
                        continue;
                    }

                    $map[(int) $row->id] = $this->db->table('parley_messages')->insertGetId([
                        'conversation_id' => $id,
                        'user_id' => $row->user_id,
                        'type' => 'text',
                        'body' => mb_substr($body, 0, Conversations::MAX_LENGTH),
                        'reply_to_id' => isset($replies[$row->id]) ? ($map[(int) $replies[$row->id]] ?? null) : null,
                        'import_key' => 'gmm:'.$row->id,
                        'created_at' => $row->created_at ?? Carbon::now(),
                    ]);
                }

                $this->reactions($rows->pluck('id')->all(), $map);

                $already = array_flip($this->db->table('parley_participants')->where('conversation_id', $id)->pluck('user_id')->map(fn ($u) => (int) $u)->all());
                foreach ($members as $member) {
                    $read = $this->readUpTo((int) $member->last_read_message_id, $map);
                    if (isset($already[(int) $member->user_id])) {
                        continue;
                    }
                    $this->db->table('parley_participants')->insert([
                        'conversation_id' => $id,
                        'user_id' => $member->user_id,
                        'joined_at' => $member->joined_at ?? Carbon::now(),
                        'last_read_message_id' => $read,
                        'role' => (int) $member->user_id === (int) $group->owner_id ? 'owner' : 'member',
                    ]);
                }

                $last = $this->db->table('parley_messages')->where('conversation_id', $id)->orderByDesc('id')->first();
                if ($last) {
                    $this->db->table('parley_conversations')->where('id', $id)
                        ->update(['last_message_id' => $last->id, 'last_message_at' => $last->created_at]);
                }
            });
        }

        $this->info(($dry ? 'Would import' : 'Imported')." $made new group(s) and $added message(s) from Group Messages.");

        return 0;
    }

    /**
     * What a formatted message says, as Parley shows it: plain text. Its
     * markup (bold, quotes, lists) would show as asterisks and angle brackets,
     * so the message is rendered and read back as text; a link keeps its
     * address, which Parley makes clickable again.
     */
    private function plain(string $xml): string
    {
        $html = $this->formatter->render($xml);

        $html = (string) preg_replace_callback('~<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>~is', function ($m) {
            $url = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
            $text = trim(strip_tags($m[2]));

            return $text === '' || html_entity_decode($text, ENT_QUOTES | ENT_HTML5) === $url ? $url : "$text ($url)";
        }, $html);
        $html = (string) preg_replace(['~<br\s*/?>~i', '~</(p|div|li|blockquote|h[1-6])>~i'], ["\n", "\n\n"], $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5);

        return trim((string) preg_replace("~\n{3,}~", "\n\n", $text));
    }

    /**
     * Reactions that are one of Parley's own, one per person per message —
     * Parley keeps one reaction each, so a person's first is the one kept.
     *
     * @param  int[]  $sourceIds
     * @param  array<int, int>  $map
     */
    private function reactions(array $sourceIds, array $map): void
    {
        if ($sourceIds === [] || ! $this->db->getSchemaBuilder()->hasTable('dialog_message_reactions')) {
            return;
        }

        $seen = [];
        foreach ($this->db->table('dialog_message_reactions')->whereIn('message_id', $sourceIds)->orderBy('id')->get() as $r) {
            $to = $map[(int) $r->message_id] ?? null;
            if (! $to || ! in_array($r->reaction, Conversations::REACTIONS, true) || isset($seen[$to.':'.$r->user_id])) {
                continue;
            }
            $seen[$to.':'.$r->user_id] = true;
            $this->db->table('parley_reactions')->insertOrIgnore([
                'message_id' => $to, 'user_id' => $r->user_id, 'emoji' => $r->reaction, 'created_at' => $r->created_at ?? Carbon::now(),
            ]);
        }
    }

    /** The newest imported message at or before the one they had read. */
    private function readUpTo(int $theirs, array $map): ?int
    {
        $best = null;
        foreach ($map as $source => $ours) {
            if ($source <= $theirs) {
                $best = max($best ?? 0, $ours);
            }
        }

        return $best;
    }

    /** A group icon stored in the forum's own assets comes across as the group's photo. */
    private function photo(?string $url): ?string
    {
        if (! $url || ! preg_match('~/assets/(.+)$~', parse_url($url, PHP_URL_PATH) ?: '', $m)) {
            return null;
        }

        $file = realpath($this->paths->public.'/assets/'.rawurldecode($m[1]));
        if (! $file || ! str_starts_with($file, (string) realpath($this->paths->public.'/assets')) || ! is_file($file)) {
            return null;
        }

        try {
            return $this->photos->storeFile($file);
        } catch (\Throwable) {
            return null;
        }
    }
}
