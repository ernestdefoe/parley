<?php

namespace Ernestdefoe\Parley;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * The photos, videos, voice notes and files messages carry, removed from the
 * disk once no message shows them any more.
 *
 * Forwarding copies a message's meta, so one stored file can belong to
 * several messages in different conversations. A file goes only when no
 * other message that still shows it (not deleted) names it. That is looked
 * up with a JSON path on `meta->file` — json_extract on SQLite and MySQL,
 * `->>` on PostgreSQL — which the builder writes per driver and which, unlike
 * whereJsonContains, keeps working on a prefixed SQLite. It is a scan rather
 * than an index lookup, but it runs only when something is deleted, and only
 * for messages that carry a file.
 */
class MessageFiles
{
    /** Message types whose meta names a stored file. */
    public const TYPES = ['image', 'voice', 'video', 'file'];

    public function __construct(
        protected ConnectionInterface $db,
        protected Images $images
    ) {
    }

    /** A message was deleted: its file goes unless a forwarded copy still shows it. */
    public function forgetMessage(object $message): void
    {
        $file = self::fileOf($message);

        if ($file !== null) {
            $this->removeUnshared([$file], $this->db->table('parley_messages')->where('id', '!=', $message->id));
        }
    }

    /** A conversation is about to be deleted: its messages' files go, less any shown elsewhere. */
    public function forgetConversation(int $conversationId): void
    {
        $files = [];
        foreach ($this->db->table('parley_messages')->where('conversation_id', $conversationId)
            ->whereIn('type', self::TYPES)->whereNotNull('meta')->get(['type', 'meta']) as $row) {
            if (($file = self::fileOf($row)) !== null) {
                $files[$file] = true;
            }
        }

        if ($files !== []) {
            $this->removeUnshared(array_keys($files), $this->db->table('parley_messages')->where('conversation_id', '!=', $conversationId));
        }
    }

    /**
     * @param  list<string>  $files
     * @param  Builder  $others  the messages that do not count as this one
     */
    private function removeUnshared(array $files, Builder $others): void
    {
        $shared = [];
        foreach (array_chunk($files, 200) as $chunk) {
            foreach ((clone $others)->whereIn('type', self::TYPES)->whereNull('deleted_at')
                ->whereIn('meta->file', $chunk)->get(['type', 'meta']) as $row) {
                if (($file = self::fileOf($row)) !== null) {
                    $shared[$file] = true;
                }
            }
        }

        foreach ($files as $file) {
            if (! isset($shared[$file])) {
                $this->images->remove($file);
            }
        }
    }

    private static function fileOf(object $message): ?string
    {
        if (! in_array($message->type ?? null, self::TYPES, true) || empty($message->meta)) {
            return null;
        }

        $file = ((array) json_decode((string) $message->meta, true))['file'] ?? null;

        return is_string($file) && $file !== '' ? $file : null;
    }
}
