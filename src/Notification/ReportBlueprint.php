<?php

namespace Ernestdefoe\Parley\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/** "A message from X was reported", for staff. */
class ReportBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public User $reported,
        public User $reporter
    ) {
    }

    public function getFromUser(): ?User
    {
        return $this->reporter;
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->reported;
    }

    public function getData(): mixed
    {
        return null;
    }

    public static function getType(): string
    {
        return 'parleyReport';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
