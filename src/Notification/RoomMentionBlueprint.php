<?php

namespace Ernestdefoe\Parley\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/** "BuckeyeBrian mentioned you in #game-day". */
class RoomMentionBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public User $sender,
        public int $roomId,
        public int $messageId
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
        return ['conversationId' => $this->roomId, 'messageId' => $this->messageId];
    }

    public static function getType(): string
    {
        return 'parleyRoomMention';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
