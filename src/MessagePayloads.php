<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;

/**
 * Messages as the client draws them: reactions, pins, the message replied to
 * and each author, loaded for the whole page at once.
 */
class MessagePayloads
{
    public function __construct(
        protected ConnectionInterface $db,
        protected People $people
    ) {
    }

    /**
     * @param  list<object>  $rows
     * @return list<array<string, mixed>>
     */
    public function payloads(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rows);

        $reactions = [];
        foreach ($this->db->table('parley_reactions')->whereIn('message_id', $ids)->orderBy('created_at')->get() as $r) {
            $reactions[(int) $r->message_id][] = ['userId' => (int) $r->user_id, 'emoji' => $r->emoji];
        }

        $pinned = array_fill_keys($this->db->table('parley_pins')->whereIn('message_id', $ids)
            ->pluck('message_id')->map(fn ($id) => (int) $id)->all(), true);

        $replyIds = array_values(array_filter(array_map(fn ($r) => (int) $r->reply_to_id, $rows)));
        $replies = $replyIds === [] ? collect() : $this->db->table('parley_messages')->whereIn('id', $replyIds)->get()->keyBy('id');

        // Each message carries its author: in a room the client has not met
        // most of the people talking, and one query here beats one per name.
        $authorIds = array_values(array_unique(array_filter(array_merge(
            array_map(fn ($r) => (int) $r->user_id, $rows),
            $replies->pluck('user_id')->map(fn ($id) => (int) $id)->all()
        ))));
        $authors = $this->people->users($authorIds);

        return array_map(function ($r) use ($reactions, $replies, $authors, $pinned) {
            $deleted = $r->deleted_at !== null;
            $reply = $r->reply_to_id ? $replies->get($r->reply_to_id) : null;

            return [
                'id' => (int) $r->id,
                'conversationId' => (int) $r->conversation_id,
                'userId' => $r->user_id ? (int) $r->user_id : null,
                'author' => $r->user_id && $authors->get((int) $r->user_id) ? $this->people->card($authors->get((int) $r->user_id)) : null,
                'type' => $r->type,
                'body' => $deleted ? null : $r->body,
                'meta' => $deleted || $r->meta === null ? null : json_decode($r->meta, true),
                'replyTo' => $reply ? [
                    'id' => (int) $reply->id,
                    'userId' => $reply->user_id ? (int) $reply->user_id : null,
                    'authorName' => $reply->user_id && $authors->get((int) $reply->user_id) ? $authors->get((int) $reply->user_id)->display_name : null,
                    'excerpt' => $reply->deleted_at ? null : (in_array($reply->type, ['text', 'file'], true) ? mb_substr((string) $reply->body, 0, 120) : null),
                    'type' => $reply->type,
                ] : null,
                'reactions' => $deleted ? [] : ($reactions[(int) $r->id] ?? []),
                'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
                'editedAt' => $r->edited_at ? Carbon::parse($r->edited_at)->toIso8601String() : null,
                'deleted' => $deleted,
                'pinned' => isset($pinned[(int) $r->id]),
            ];
        }, $rows);
    }
}
