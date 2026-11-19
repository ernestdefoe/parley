<?php

namespace Ernestdefoe\Parley\Console;

use Carbon\Carbon;
use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\GroupPhotos;
use Ernestdefoe\Parley\MessageLinks;
use Flarum\Console\AbstractCommand;
use Flarum\Foundation\ValidationException;
use Flarum\Formatter\Formatter;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
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
    /** Groups read per query. */
    public const CHUNK = 100;

    public function __construct(
        protected ConnectionInterface $db,
        protected Formatter $formatter,
        protected GroupPhotos $photos,
        protected Factory $filesystems
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
        // Asked once here, not once per group.
        $source = ['replies' => $schema->hasTable('dialog_message_replies'), 'reactions' => $schema->hasTable('dialog_message_reactions')];
        $totals = [0, 0];

        $this->db->table('group_dialogs as g')->join('dialogs as d', 'd.id', '=', 'g.dialog_id')
            ->select(['g.*', 'd.created_at as dialog_created_at'])
            ->chunkById(self::CHUNK, function (Collection $groups) use ($dry, $source, &$totals) {
                [$made, $added] = $this->importChunk($groups, $dry, $source);
                $totals[0] += $made;
                $totals[1] += $added;
            }, 'g.dialog_id', 'dialog_id');

        $this->info(($dry ? 'Would import' : 'Imported')." $totals[0] new group(s) and $totals[1] message(s) from Group Messages.");

        return 0;
    }

    /**
     * Up to CHUNK groups: their members, the conversations already made from
     * them, what those already hold and who is already in them come in one
     * query each for the whole chunk.
     *
     * @param  array{replies: bool, reactions: bool}  $source
     * @return array{int, int} new groups, new messages
     */
    private function importChunk(Collection $groups, bool $dry, array $source): array
    {
        $members = $this->db->table('dialog_user')->whereIn('dialog_id', $groups->pluck('dialog_id')->all())->get()->groupBy('dialog_id');
        $existing = $this->db->table('parley_conversations')
            ->whereIn('import_key', $groups->map(fn ($g) => 'gm:'.$g->dialog_id)->all())->get()->keyBy('import_key');
        $imported = $this->importedMessages($existing->pluck('id')->all());
        $already = $existing->isEmpty() ? collect() : $this->db->table('parley_participants')
            ->whereIn('conversation_id', $existing->pluck('id')->all())->get(['conversation_id', 'user_id'])->groupBy('conversation_id');

        [$made, $added] = [0, 0];
        foreach ($groups as $group) {
            $who = $members->get($group->dialog_id, collect());
            $conversation = $existing->get('gm:'.$group->dialog_id);
            if ($who->isEmpty() || (! $conversation && $who->count() < 2)) {
                continue;
            }

            $map = $conversation ? ($imported[(int) $conversation->id] ?? []) : [];
            $rows = $this->newMessages((int) $group->dialog_id, $map, $source['replies']);
            $made += $conversation ? 0 : 1;
            $added += $rows->count();

            if (! $dry) {
                $in = $conversation ? $already->get($conversation->id, collect())->pluck('user_id')->map(fn ($u) => (int) $u)->all() : [];
                $this->db->transaction(fn () => $this->importGroup($group, $who, $rows, $conversation, $map, $in, $source['reactions']));
            }
        }

        return [$made, $added];
    }

    /**
     * What these conversations already hold from Group Messages.
     *
     * @param  array<int, int|string>  $conversationIds
     * @return array<int, array<int, int>> conversation id => (their message id => ours)
     */
    private function importedMessages(array $conversationIds): array
    {
        if ($conversationIds === []) {
            return [];
        }

        $out = [];
        $rows = $this->db->table('parley_messages')->whereIn('conversation_id', $conversationIds)
            ->whereNotNull('import_key')->get(['id', 'conversation_id', 'import_key']);
        foreach ($rows as $m) {
            if (str_starts_with((string) $m->import_key, 'gmm:')) {
                $out[(int) $m->conversation_id][(int) substr((string) $m->import_key, 4)] = (int) $m->id;
            }
        }

        return $out;
    }

    /**
     * One group's messages not brought across yet, oldest first, each with
     * the message it replies to. One group's history at a time keeps memory
     * to the largest group, not the whole table.
     *
     * @param  array<int, int>  $map  their message id => ours, for what is already here
     */
    private function newMessages(int $dialogId, array $map, bool $replies): Collection
    {
        $q = $this->db->table('dialog_messages as m')->where('m.dialog_id', $dialogId)->orderBy('m.id');
        $replies
            ? $q->leftJoin('dialog_message_replies as r', 'r.message_id', '=', 'm.id')->select(['m.*', 'r.reply_to_id'])
            : $q->select(['m.*']);

        return $q->get()->reject(fn ($row) => isset($map[(int) $row->id]))->values();
    }

    /**
     * One group, in one transaction: new rows only, keyed to where they came from.
     *
     * @param  array<int, int>  $map  their message id => ours, for what is already here
     * @param  int[]  $already  who is already in the conversation
     */
    private function importGroup(object $group, Collection $members, Collection $rows, ?object $existing, array $map, array $already, bool $reactions): void
    {
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

        $map = $this->copyMessages($id, $rows, $map);
        if ($reactions) {
            $this->reactions($rows->pluck('id')->all(), $map);
        }
        $this->addMembers($id, $group, $members, $map, $already);

        $last = $this->db->table('parley_messages')->where('conversation_id', $id)->orderByDesc('id')->first();
        if ($last) {
            $this->db->table('parley_conversations')->where('id', $id)
                ->update(['last_message_id' => $last->id, 'last_message_at' => $last->created_at]);
        }
    }

    /**
     * One insert per message, in order: a reply points at our id for the
     * message it answers, which exists only once that message is in.
     *
     * @param  array<int, int>  $map  their message id => ours
     * @return array<int, int> the same, with these messages added
     */
    private function copyMessages(int $id, Collection $rows, array $map): array
    {
        foreach ($rows as $row) {
            $body = $this->plain((string) $row->content);
            if ($body === '') {
                continue;
            }

            $body = mb_substr($body, 0, Conversations::MAX_LENGTH);
            $replyTo = $row->reply_to_id ?? null;
            $map[(int) $row->id] = (int) $this->db->table('parley_messages')->insertGetId([
                'conversation_id' => $id,
                'user_id' => $row->user_id,
                'type' => 'text',
                'body' => $body,
                // Listed under Links, as a message sent in Parley would be.
                'has_link' => MessageLinks::has($body),
                'reply_to_id' => $replyTo ? ($map[(int) $replyTo] ?? null) : null,
                'import_key' => 'gmm:'.$row->id,
                'created_at' => $row->created_at ?? Carbon::now(),
            ]);
        }

        return $map;
    }

    /**
     * Everyone not already in, in one insert, each keeping their place.
     *
     * @param  array<int, int>  $map
     * @param  int[]  $already
     */
    private function addMembers(int $id, object $group, Collection $members, array $map, array $already): void
    {
        $already = array_flip($already);
        $rows = $members->unique('user_id')
            ->reject(fn ($member) => isset($already[(int) $member->user_id]))
            ->map(fn ($member) => [
                'conversation_id' => $id,
                'user_id' => $member->user_id,
                'joined_at' => $member->joined_at ?? Carbon::now(),
                'last_read_message_id' => $this->readUpTo((int) $member->last_read_message_id, $map),
                'role' => (int) $member->user_id === (int) $group->owner_id ? 'owner' : 'member',
            ])->values()->all();

        if ($rows !== []) {
            $this->db->table('parley_participants')->insert($rows);
        }
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
        // A message's reactions all fall in the same slice, so "first kept"
        // holds; slices keep the id list under every driver's bind limit.
        $seen = [];
        foreach (array_chunk($sourceIds, 1000) as $slice) {
            $kept = [];
            foreach ($this->db->table('dialog_message_reactions')->whereIn('message_id', $slice)->orderBy('id')->get() as $r) {
                $to = $map[(int) $r->message_id] ?? null;
                if (! $to || ! in_array($r->reaction, Conversations::REACTIONS, true) || isset($seen[$to.':'.$r->user_id])) {
                    continue;
                }
                $seen[$to.':'.$r->user_id] = true;
                $kept[] = ['message_id' => $to, 'user_id' => $r->user_id, 'emoji' => $r->reaction, 'created_at' => $r->created_at ?? Carbon::now()];
            }
            if ($kept !== []) {
                $this->db->table('parley_reactions')->insertOrIgnore($kept);
            }
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

        // A path on the assets disk, never one that climbs out of it.
        $path = rawurldecode($m[1]);
        $assets = $this->filesystems->disk('flarum-assets');
        if (str_contains($path, '..') || ! $assets->exists($path)) {
            return null;
        }

        try {
            return $this->photos->storeBytes((string) $assets->get($path));
        } catch (ValidationException) {
            // Not a picture Parley keeps: the group comes across without one.
            $this->info("Skipped the group icon $path: not a JPEG, PNG, GIF or WebP under ".GroupPhotos::MAX_MB.' MB.');

            return null;
        }
    }
}
