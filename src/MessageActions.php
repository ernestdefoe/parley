<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * What is done to one message once it is sent: edit, delete, react, forward.
 * Each change is pushed to everyone who can see the message.
 */
class MessageActions
{
    public function __construct(
        protected ConnectionInterface $db,
        protected Conversations $conversations,
        protected Rooms $rooms,
        protected Broadcaster $broadcaster,
        protected TranslatorInterface $translator,
        protected MessageFiles $files
    ) {
    }

    /**
     * Send the same message on to other conversations: up to five, each one
     * a conversation the sender may write in.
     *
     * @param  int[]  $conversationIds
     * @return list<array<string, mixed>>
     */
    public function forward(int $messageId, User $actor, array $conversationIds): array
    {
        $message = $this->conversations->message($messageId);

        if (! $message || $message->deleted_at || ! in_array($message->type, Conversations::CONTENT, true)
            || ! $this->conversations->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        $ids = array_slice(array_values(array_unique(array_map('intval', $conversationIds))), 0, 5);
        if ($ids === []) {
            throw new ValidationException(['conversationIds' => $this->translator->trans('ernestdefoe-parley.api.forward_where')]);
        }

        // Every target is checked before anything is sent: all or nothing.
        $targets = array_map(fn (int $id) => $this->conversations->find($id, $actor), $ids);

        $meta = $message->meta === null ? [] : (array) json_decode($message->meta, true);
        unset($meta['forwarded']);
        $meta['forwarded'] = true;

        return array_map(
            fn (object $target) => $this->conversations->send($target, $actor, $message->type, $message->body, $meta),
            $targets
        );
    }

    public function edit(int $messageId, User $actor, string $body): array
    {
        $message = $this->ownMessage($messageId, $actor);
        $body = trim($body);

        if ($message->type !== 'text' || $body === '' || mb_strlen($body) > Conversations::MAX_LENGTH) {
            throw new ValidationException(['body' => $this->translator->trans('ernestdefoe-parley.api.empty_message')]);
        }

        $this->db->table('parley_messages')->where('id', $messageId)
            ->update(['body' => $body, 'edited_at' => date('Y-m-d H:i:s')]);

        return $this->changed($messageId);
    }

    public function delete(int $messageId, User $actor): array
    {
        $message = $this->conversations->message($messageId);
        $conversation = $message ? $this->db->table('parley_conversations')->find($message->conversation_id) : null;

        // Rooms are public, so moderators keep them tidy. Direct conversations
        // stay private: there, only the author can remove a message.
        $moderating = $conversation && $this->rooms->isRoom($conversation)
            && $this->rooms->canChat($conversation, $actor)
            && $actor->hasPermission(Gate::MODERATE)
            && ! $message->deleted_at;

        if (! $moderating) {
            $message = $this->ownMessage($messageId, $actor);
        }

        $this->db->table('parley_messages')->where('id', $messageId)
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        $this->db->table('parley_reactions')->where('message_id', $messageId)->delete();
        $this->db->table('parley_pins')->where('message_id', $messageId)->delete();

        // A deleted message is never shown again, so neither is its photo or
        // file: the bytes go too, unless a forwarded copy still shows them.
        $this->files->forgetMessage($message);

        return $this->changed($messageId);
    }

    /** Pick a reaction; picking the one you already have takes it away. */
    public function react(int $messageId, User $actor, string $emoji): array
    {
        if (! in_array($emoji, Conversations::REACTIONS, true)) {
            throw new ValidationException(['emoji' => $this->translator->trans('ernestdefoe-parley.api.unknown_reaction')]);
        }

        $message = $this->conversations->message($messageId);
        if (! $message || $message->deleted_at || ! $this->conversations->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        // Picking the reaction you already have takes it away; anything else
        // is one atomic upsert on the (message, user) key, so a double tap
        // cannot insert twice.
        $mine = ['message_id' => $messageId, 'user_id' => $actor->id];
        if ($this->db->table('parley_reactions')->where($mine)->value('emoji') === $emoji) {
            $this->db->table('parley_reactions')->where($mine)->delete();
        } else {
            $this->db->table('parley_reactions')->upsert(
                [$mine + ['emoji' => $emoji, 'created_at' => date('Y-m-d H:i:s')]],
                ['message_id', 'user_id'],
                ['emoji', 'created_at']
            );
        }

        return $this->changed($messageId);
    }

    private function ownMessage(int $messageId, User $actor): object
    {
        $message = $this->conversations->message($messageId);

        if (! $message || ! $this->conversations->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        if ((int) $message->user_id !== $actor->id || $message->deleted_at) {
            throw new PermissionDeniedException();
        }

        return $message;
    }

    private function changed(int $messageId): array
    {
        $payload = $this->conversations->payloads([$this->conversations->message($messageId)])[0];
        $conversation = $this->db->table('parley_conversations')->find($payload['conversationId']);
        $members = $this->conversations->participantIds($payload['conversationId']);

        if ($conversation && $this->rooms->isRoom($conversation)) {
            $members = $this->rooms->audience($conversation, $members);
        }

        $this->broadcaster->toUsers($members, 'messageChanged', ['message' => $payload]);

        return $payload;
    }
}
