<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Messages pinned to the top of a conversation, the same for everyone in it.
 * Anyone in a direct or group conversation may pin; in a room, which is
 * public, only moderators do.
 */
class Pins
{
    public const MAX = 50;

    public function __construct(
        protected ConnectionInterface $db,
        protected Conversations $conversations,
        protected Rooms $rooms,
        protected Broadcaster $broadcaster,
        protected TranslatorInterface $translator
    ) {
    }

    /** @return array<string, mixed> the message, as it now reads */
    public function set(int $messageId, User $actor, bool $on): array
    {
        $message = $this->conversations->message($messageId);

        if (! $message || $message->deleted_at || ! in_array($message->type, [...Conversations::CONTENT, 'call'], true)
            || ! $this->conversations->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        /** @var object $conversation */
        $conversation = $this->db->table('parley_conversations')->find($message->conversation_id);
        if ($this->rooms->isRoom($conversation) && ! $actor->hasPermission(Gate::MODERATE)) {
            throw new PermissionDeniedException();
        }

        $pin = $this->db->table('parley_pins')->where('message_id', $messageId);

        if (! $on) {
            $pin->delete();
        } elseif (! $pin->exists()) {
            if ($this->db->table('parley_pins')->where('conversation_id', $conversation->id)->count() >= self::MAX) {
                throw new ValidationException(['message' => $this->translator->trans('ernestdefoe-parley.api.too_many_pins', ['max' => self::MAX])]);
            }

            $this->db->table('parley_pins')->insert([
                'message_id' => $messageId,
                'conversation_id' => $conversation->id,
                'user_id' => $actor->id,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            // "Ana pinned a message" — so everyone knows why the bar changed.
            $this->conversations->send($conversation, $actor, 'system', null, [
                'action' => 'pinned',
                'messageId' => $messageId,
            ]);
        }

        $payload = $this->conversations->payloads([$this->conversations->message($messageId)])[0];
        $members = $this->conversations->participantIds((int) $conversation->id);
        if ($this->rooms->isRoom($conversation)) {
            $members = $this->rooms->audience($conversation, $members);
        }
        $this->broadcaster->toUsers($members, 'messageChanged', ['message' => $payload]);

        return $payload;
    }

    /**
     * A conversation's pinned messages, newest pin first.
     *
     * @return list<array<string, mixed>>
     */
    public function list(int $conversationId): array
    {
        $ids = $this->db->table('parley_pins')->where('conversation_id', $conversationId)
            ->orderByDesc('created_at')->limit(self::MAX)->pluck('message_id')->map(fn ($id) => (int) $id)->all();

        if ($ids === []) {
            return [];
        }

        $rows = $this->db->table('parley_messages')->whereIn('id', $ids)->whereNull('deleted_at')->get()->keyBy('id');

        return $this->conversations->payloads(array_values(array_filter(array_map(fn ($id) => $rows->get($id), $ids))));
    }
}
