<?php

namespace Ernestdefoe\Parley\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/**
 * "BuckeyeBrian sent you a message", for someone who was not on the site.
 *
 * The subject is the sender, not the conversation: a user already has an API
 * resource the notification list can render, and a conversation is private
 * enough that it should not grow one just to be pointed at.
 */
class NewMessageBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public User $sender,
        public int $conversationId
    ) {
    }

    public function getFromUser(): ?User
    {
        return $this->sender;
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->sender;
    }

    public function getData(): array
    {
        return ['conversationId' => $this->conversationId];
    }

    public static function getType(): string
    {
        return 'parleyMessage';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
