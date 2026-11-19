<?php

namespace Ernestdefoe\Parley;

use Illuminate\Database\ConnectionInterface;

/**
 * parley_messages.has_link: whether a message's text carries a web address,
 * so a conversation's links are listed without searching every body.
 */
class MessageLinks
{
    public static function has(?string $body): bool
    {
        return $body !== null && preg_match('~https?://~i', $body) === 1;
    }

    /**
     * Mark existing messages, a thousand at a time by id, deciding in PHP
     * rather than with LIKE '%http%', which no index can serve.
     */
    public static function backfill(ConnectionInterface $db): void
    {
        $db->table('parley_messages')->whereNotNull('body')->select(['id', 'body'])
            ->chunkById(1000, function ($rows) use ($db) {
                $ids = $rows->filter(fn ($row) => self::has((string) $row->body))->pluck('id')->all();

                if ($ids !== []) {
                    $db->table('parley_messages')->whereIn('id', $ids)->update(['has_link' => true]);
                }
            });
    }
}
