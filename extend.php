<?php

use Ernestdefoe\Parley\Api;
use Ernestdefoe\Parley\Broadcaster;
use Ernestdefoe\Parley\Console\ImportRamonCommand;
use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Notification\NewMessageBlueprint;
use Ernestdefoe\Parley\Notification\ReportBlueprint;
use Ernestdefoe\Parley\Notification\RoomMentionBlueprint;
use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less')
        ->route('/parley', 'parley.inbox')
        ->route('/parley/{id:\d+}', 'parley.conversation'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Routes('api'))
        ->post('/parley/heartbeat', 'ernestdefoe-parley.heartbeat', Api\HeartbeatController::class)
        ->post('/parley/leave', 'ernestdefoe-parley.leave', Api\HeartbeatController::class)
        ->get('/parley/rooms', 'ernestdefoe-parley.rooms', Api\RoomsController::class)
        ->post('/parley/rooms/{id:\d+}/join', 'ernestdefoe-parley.rooms.join', Api\RoomsController::class)
        ->post('/parley/rooms/{id:\d+}/leave', 'ernestdefoe-parley.rooms.leave', Api\RoomsController::class)
        ->get('/parley/admin/rooms', 'ernestdefoe-parley.rooms.admin', Api\RoomsController::class)
        ->post('/parley/admin/rooms', 'ernestdefoe-parley.rooms.admin.create', Api\RoomsController::class)
        ->patch('/parley/admin/rooms/{id:\d+}', 'ernestdefoe-parley.rooms.admin.update', Api\RoomsController::class)
        ->delete('/parley/admin/rooms/{id:\d+}', 'ernestdefoe-parley.rooms.admin.delete', Api\RoomsController::class)
        ->post('/parley/admin/rooms/order', 'ernestdefoe-parley.rooms.admin.order', Api\RoomsController::class)
        ->get('/parley/conversations', 'ernestdefoe-parley.conversations', Api\ConversationsController::class)
        ->post('/parley/conversations', 'ernestdefoe-parley.conversations.open', Api\ConversationsController::class)
        ->get('/parley/conversations/{id:\d+}', 'ernestdefoe-parley.conversation', Api\ShowConversationController::class)
        ->post('/parley/conversations/{id:\d+}/messages', 'ernestdefoe-parley.send', Api\SendMessageController::class)
        ->post('/parley/conversations/{id:\d+}/images', 'ernestdefoe-parley.image.upload', Api\UploadImageController::class)
        ->post('/parley/conversations/{id:\d+}/{action:read|typing|hide|mute}', 'ernestdefoe-parley.conversation.action', Api\ConversationActionController::class)
        ->patch('/parley/messages/{id:\d+}', 'ernestdefoe-parley.message.edit', Api\MessageController::class)
        ->delete('/parley/messages/{id:\d+}', 'ernestdefoe-parley.message.delete', Api\MessageController::class)
        ->post('/parley/messages/{id:\d+}/react', 'ernestdefoe-parley.react', Api\ReactController::class)
        ->post('/parley/messages/{id:\d+}/report', 'ernestdefoe-parley.report', Api\ReportsController::class)
        ->get('/parley/images/{id:\d+}', 'ernestdefoe-parley.image', Api\ImageController::class)
        ->get('/parley/people', 'ernestdefoe-parley.people', Api\PeopleController::class)
        ->post('/parley/people/{id:\d+}/{action:follow|block}', 'ernestdefoe-parley.person.action', Api\PersonActionController::class)
        ->get('/parley/reports', 'ernestdefoe-parley.reports', Api\ReportsController::class)
        ->post('/parley/reports/{id:\d+}/resolve', 'ernestdefoe-parley.reports.resolve', Api\ReportsController::class),

    (new Extend\User())
        ->registerPreference('parleyStatus', fn ($v) => in_array($v, ['online', 'busy', 'invisible'], true) ? $v : 'online', 'online')
        ->registerPreference('parleyWhoCanMessage', fn ($v) => in_array($v, ['everyone', 'following', 'nobody'], true) ? $v : 'everyone', 'everyone'),

    (new Extend\Notification())
        ->type(NewMessageBlueprint::class, ['alert'])
        ->type(ReportBlueprint::class, ['alert'])
        ->type(RoomMentionBlueprint::class, ['alert']),

    (new Extend\Settings())
        ->default('ernestdefoe-parley.max_image_mb', 8)
        ->default('ernestdefoe-parley.away_minutes', 10),

    (new Extend\Console())
        ->command(ImportRamonCommand::class),

    /*
     * Everything the client needs before its first heartbeat, in the boot
     * payload, so the rail draws on first paint instead of after a round trip.
     */
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Arr::make('parley')
                ->get(function ($forum, Context $context) {
                    $actor = $context->getActor();
                    $gate = resolve(Gate::class);
                    $settings = resolve(\Flarum\Settings\SettingsRepositoryInterface::class);

                    return [
                        'canUse' => $gate->canUse($actor),
                        'canModerate' => ! $actor->isGuest() && $actor->hasPermission(Gate::MODERATE),
                        'realtime' => resolve(Broadcaster::class)->available(),
                        'awayMinutes' => (int) $settings->get('ernestdefoe-parley.away_minutes') ?: 10,
                        'maxImageMb' => (int) $settings->get('ernestdefoe-parley.max_image_mb') ?: 8,
                        'reactions' => Conversations::REACTIONS,
                    ];
                }),
        ]),
];
