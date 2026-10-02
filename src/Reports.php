<?php

namespace Ernestdefoe\Parley;

use Carbon\Carbon;
use Ernestdefoe\Parley\Notification\ReportBlueprint;
use Flarum\Group\Group;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Reporting a message to staff.
 *
 * Moderators never read conversations. What they see is the snapshot taken at
 * the moment of the report — the message and the five before it — so they can
 * judge it in context, and nothing else from that conversation.
 */
class Reports
{
    public function __construct(
        protected ConnectionInterface $db,
        protected Conversations $conversations,
        protected People $people,
        protected NotificationSyncer $notifications
    ) {
    }

    public function file(int $messageId, User $reporter, ?string $reason): void
    {
        $message = $this->conversations->message($messageId);

        if (! $message || ! $this->conversations->isParticipant((int) $message->conversation_id, $reporter->id)
            || (int) $message->user_id === $reporter->id) {
            throw new ModelNotFoundException();
        }

        $rows = $this->db->table('parley_messages')
            ->where('conversation_id', $message->conversation_id)
            ->where('id', '<=', $messageId)
            ->orderByDesc('id')->limit(6)->get()->reverse()->values()->all();

        $snapshot = array_map(fn ($m) => [
            'id' => (int) $m->id,
            'userId' => $m->user_id ? (int) $m->user_id : null,
            'type' => $m->type,
            'body' => $m->deleted_at ? null : $m->body,
            'createdAt' => Carbon::parse($m->created_at)->toIso8601String(),
            'reported' => (int) $m->id === $messageId,
        ], $rows);

        $this->db->table('parley_reports')->insert([
            'message_id' => $messageId,
            'reporter_id' => $reporter->id,
            'reported_user_id' => $message->user_id,
            'reason' => $reason !== null ? mb_substr(trim($reason), 0, 500) : null,
            'snapshot' => json_encode($snapshot),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $reported = $message->user_id ? User::find($message->user_id) : null;
        if ($reported) {
            $this->notifications->sync(new ReportBlueprint($reported, $reporter), $this->moderators());
        }
    }

    /** @return list<array<string, mixed>> */
    public function open(): array
    {
        $rows = $this->db->table('parley_reports')->whereNull('resolved_at')->orderByDesc('id')->limit(50)->get();

        $userIds = [];
        foreach ($rows as $r) {
            $userIds[] = (int) $r->reporter_id;
            $userIds[] = (int) $r->reported_user_id;
            foreach (json_decode($r->snapshot, true) ?: [] as $m) {
                $userIds[] = (int) $m['userId'];
            }
        }

        $users = User::query()->whereIn('id', array_filter(array_unique($userIds)))->get()->keyBy('id');
        $card = fn ($id) => $id && $users->get($id) ? $this->people->card($users->get($id)) : null;

        return $rows->map(fn ($r) => [
            'id' => (int) $r->id,
            'reason' => $r->reason,
            'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
            'reporter' => $card((int) $r->reporter_id),
            'reported' => $card((int) $r->reported_user_id),
            'snapshot' => array_map(fn ($m) => $m + ['user' => $card((int) $m['userId'])], json_decode($r->snapshot, true) ?: []),
        ])->values()->all();
    }

    public function resolve(int $id, User $moderator): void
    {
        $this->db->table('parley_reports')->where('id', $id)->whereNull('resolved_at')
            ->update(['resolved_at' => date('Y-m-d H:i:s'), 'resolved_by_id' => $moderator->id]);
    }

    /** @return User[] */
    private function moderators(): array
    {
        $groups = $this->db->table('group_permission')->where('permission', Gate::MODERATE)->pluck('group_id')->all();
        $groups[] = Group::ADMINISTRATOR_ID;

        return User::query()
            ->whereHas('groups', fn ($q) => $q->whereIn('groups.id', $groups))
            ->limit(50)->get()->all();
    }
}
