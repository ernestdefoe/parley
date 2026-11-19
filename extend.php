<?php

use Ernestdefoe\Parley\Api;
use Ernestdefoe\Parley\Console\ImportGroupMessagesCommand;
use Ernestdefoe\Parley\Console\ImportRamonCommand;
use Ernestdefoe\Parley\Console\PrunePresenceCommand;
use Ernestdefoe\Parley\Notification\NewMessageBlueprint;
use Ernestdefoe\Parley\Notification\ReportBlueprint;
use Ernestdefoe\Parley\Notification\RoomMentionBlueprint;
use Ernestdefoe\Parley\ParleyServiceProvider;
use Ernestdefoe\Parley\Tags\TagsServiceProvider;
use Ernestdefoe\Parley\UploadsDisk;
use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Illuminate\Console\Scheduling\Event;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        // The messages page, the conversation body, the emoji picker, the
        // recorder and the modals: chunks fetched when first used.
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        ->route('/parley', 'parley.inbox')
        ->route('/parley/{id:\d+}', 'parley.conversation'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\ServiceProvider())
        ->register(ParleyServiceProvider::class),

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
        ->post('/parley/admin/rooms/{id:\d+}/image', 'ernestdefoe-parley.rooms.admin.image', Api\RoomsController::class)
        ->delete('/parley/admin/rooms/{id:\d+}/image', 'ernestdefoe-parley.rooms.admin.image.delete', Api\RoomsController::class)
        ->get('/parley/conversations', 'ernestdefoe-parley.conversations', Api\ConversationsController::class)
        ->post('/parley/conversations', 'ernestdefoe-parley.conversations.open', Api\ConversationsController::class)
        ->get('/parley/conversations/{id:\d+}', 'ernestdefoe-parley.conversation', Api\ShowConversationController::class)
        ->post('/parley/conversations/{id:\d+}/messages', 'ernestdefoe-parley.send', Api\SendMessageController::class)
        ->post('/parley/conversations/{id:\d+}/images', 'ernestdefoe-parley.image.upload', Api\UploadImageController::class)
        ->post('/parley/conversations/{id:\d+}/files', 'ernestdefoe-parley.file.upload', Api\UploadFileController::class)
        ->get('/parley/conversations/{id:\d+}/details', 'ernestdefoe-parley.details', Api\DetailsController::class)
        ->post('/parley/conversations/{id:\d+}/{action:read|typing|hide|mute|accept|settings}', 'ernestdefoe-parley.conversation.action', Api\ConversationActionController::class)
        ->post('/parley/groups', 'ernestdefoe-parley.groups.create', Api\GroupsController::class)
        ->patch('/parley/conversations/{id:\d+}', 'ernestdefoe-parley.groups.rename', Api\GroupsController::class)
        ->post('/parley/conversations/{id:\d+}/photo', 'ernestdefoe-parley.groups.photo', Api\GroupsController::class)
        ->delete('/parley/conversations/{id:\d+}/photo', 'ernestdefoe-parley.groups.photo.delete', Api\GroupsController::class)
        ->post('/parley/conversations/{id:\d+}/members', 'ernestdefoe-parley.groups.members.add', Api\GroupsController::class)
        ->delete('/parley/conversations/{id:\d+}/members/{userId:\d+}', 'ernestdefoe-parley.groups.members.remove', Api\GroupsController::class)
        ->patch('/parley/messages/{id:\d+}', 'ernestdefoe-parley.message.edit', Api\MessageController::class)
        ->delete('/parley/messages/{id:\d+}', 'ernestdefoe-parley.message.delete', Api\MessageController::class)
        ->post('/parley/messages/{id:\d+}/react', 'ernestdefoe-parley.react', Api\ReactController::class)
        ->post('/parley/messages/{id:\d+}/pin', 'ernestdefoe-parley.message.pin', Api\MessageActionController::class)
        ->post('/parley/messages/{id:\d+}/forward', 'ernestdefoe-parley.message.forward', Api\MessageActionController::class)
        ->post('/parley/messages/{id:\d+}/report', 'ernestdefoe-parley.report', Api\ReportsController::class)
        ->get('/parley/images/{id:\d+}', 'ernestdefoe-parley.image', Api\ImageController::class)
        ->get('/parley/files/{id:\d+}', 'ernestdefoe-parley.file', Api\ImageController::class)
        ->get('/parley/search', 'ernestdefoe-parley.search', Api\SearchController::class)
        ->get('/parley/people', 'ernestdefoe-parley.people', Api\PeopleController::class)
        ->post('/parley/people/{id:\d+}/{action:follow|block}', 'ernestdefoe-parley.person.action', Api\PersonActionController::class)
        ->get('/parley/reports', 'ernestdefoe-parley.reports', Api\ReportsController::class)
        ->post('/parley/reports/{id:\d+}/resolve', 'ernestdefoe-parley.reports.resolve', Api\ReportsController::class),

    (new Extend\User())
        ->registerPreference('parleyStatus', fn ($v) => in_array($v, ['online', 'busy', 'invisible'], true) ? $v : 'online', 'online')
        ->registerPreference('parleyWhoCanMessage', fn ($v) => in_array($v, ['everyone', 'everyone_inbox', 'following', 'nobody'], true) ? $v : 'everyone', 'everyone'),

    (new Extend\Notification())
        ->type(NewMessageBlueprint::class, ['alert'])
        ->type(ReportBlueprint::class, ['alert'])
        ->type(RoomMentionBlueprint::class, ['alert']),

    (new Extend\Settings())
        ->default('ernestdefoe-parley.max_image_mb', 8)
        ->default('ernestdefoe-parley.max_file_mb', 25)
        ->default('ernestdefoe-parley.max_voice_seconds', 300)
        ->default('ernestdefoe-parley.group_max_members', 50)
        ->default('ernestdefoe-parley.away_minutes', 10),

    (new Extend\Console())
        ->command(ImportRamonCommand::class)
        ->command(ImportGroupMessagesCommand::class)
        ->command(PrunePresenceCommand::class)
        ->schedule(PrunePresenceCommand::class, function (Event $event): void {
            $event->everyTenMinutes();
        }),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(Api\ForumResourceFields::class),

    // What is sent in a conversation: private, outside the web root.
    (new Extend\Filesystem())
        ->disk('ernestdefoe-parley', UploadsDisk::class),

    // Rooms tied to tags, and the tag beside someone in the online list.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-tags', fn () => [
            (new Extend\ServiceProvider())->register(TagsServiceProvider::class),
        ]),
];
