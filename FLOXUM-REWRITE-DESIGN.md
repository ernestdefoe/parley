# Parley: move the custom API to Flarum 2 JSON:API resources (design)

Repo `ernestdefoe/parley`, branch `rewrite-resources`. This design closes Floxum's FC-CUSTOM-API, TD-DISPATCH and TD-LONG findings (functions over 50 lines, files over 600). Nothing in it needs Parley Calls to change.

## 0. Ground rules

1. **Services stay; resources sit on top.**
   - `Conversations`, `Inbox`, `MessagePayloads`, `Rooms`, `Groups`, `Reports`, `Pins`, `MessageActions`, `Relations`, `People`, `Gate`, `PresenceStore`, `Broadcaster` keep their public signatures. They keep taking and returning plain query-builder rows.
   - Reason: Parley Calls calls them with rows it reads itself. For example, `Calls.php:359` reads `parley_conversations` and passes the row to `Conversations::send()`.
   - Writes still go through the services, so pushes, transactions and rate limits can't be skipped.
   - The new Eloquent models are the read side: querying, visibility, relationships and JSON:API serialization.
2. **No schema change.** The models map the existing tables. There are no migrations, and Calls' direct table reads keep working.
3. **Payload shapes are fixed by the existing builders.**
   - `MessagePayloads::payloads()`, `Inbox` summaries, `Rooms::card()/listFor()`, `People::card()` and `Reports::open()` stay the single source of truth.
   - Realtime pushes keep sending them unchanged: `message`, `messageChanged`, `read`, `typing`, `conversationChanged`, `removed`, `presence`, plus Calls' `call.*` and `voice.*`.
   - Resource attributes are read from the same builders through a per-request bulk buffer. JSON:API output and pushes therefore can't drift. A parity test enforces this.
4. **Every resource class must be under 600 lines and every function under 50.** `fields()` and `endpoints()` are split into named private builders (for example `summaryFields()`, `settingFields()`, `relationshipFields()`).
5. **`endpoints()` gets no constructor.** Flarum calls it on `newInstanceWithoutConstructor()` when it builds routes (`ApiServiceProvider::populateRoutes`). Injected services may only be used inside closures.
6. **`AbstractDatabaseResource::filters()` is `final` and throws.** Any resource whose Index takes `filter[...]` needs a searcher registered with `Extend\SearchDriver(DatabaseSearchDriver::class)->addSearcher(...)->addFilter(...)`. Index then routes through `SearchManager` (`Endpoint/Index.php` setUp).

---

## (a) Route table

**Prefix decision.** JSON:API resources live at `/api/parley-<type>`. The remaining action handlers keep their current `/api/parley/...` URLs, so those client and test call sites don't change. Each action becomes its own single-purpose `RequestHandler` extending `Api\Controller`, which Calls also extends, so it stays. There is no `{action}` parameter and no route-name branching anywhere.

**Old URLs as aliases: recommended no.**
- Calls never calls Parley's HTTP API. It only uses its own `/parley/calls*` and `/parley/voice*`.
- The only clients of the old CRUD URLs are Parley's own JS and tests.
- The real risk is tabs left open across the deploy. Their sends fail with a 404, but the send queue persists failed items in localStorage (`saveQueue`, `restoreQueue`), and after a reload they show with a Retry button that uses the new API. Nothing is lost.
- Aliases would be 15 or more deprecated CRUD/list controllers, and Floxum would flag them as FC-CUSTOM-API until they're removed.
- Mitigation for future migrations: the heartbeat response gains `apiVersion: 2` (WP-3). The new JS compares it with a compiled constant and shows a "Parley was updated, reload" alert (WP-8a).
- Fallback if the owner prefers zero-404 deploys: put aliases in `src/Api/Legacy/` as single-purpose deprecated handlers for one minor release, and accept the Floxum finding for that release.

| # | Current route | New | Kind |
|---|---|---|---|
| 1 | POST /parley/heartbeat | same URL → `HeartbeatController`. The leave branch is removed. Adds `apiVersion`. | action: presence beat and online list, every 30 s |
| 2 | POST /parley/leave | same URL → `LeaveSiteController` | action: sendBeacon goodbye |
| 3 | GET /parley/rooms[?parent] | GET /api/parley-rooms?filter[rail]=1 or filter[parent]=ID | RoomResource Index |
| 4 | POST /parley/rooms/{id}/join | same URL → `JoinRoomController`. Still returns `{rooms}`. | action: membership toggle |
| 5 | POST /parley/rooms/{id}/leave | same URL → `LeaveRoomController` | action |
| 6 | GET /parley/admin/rooms | GET /api/parley-rooms?filter[manage]=1 (admin) | RoomResource Index |
| 7 | POST /parley/admin/rooms | POST /api/parley-rooms | RoomResource Create (admin) |
| 8 | PATCH /parley/admin/rooms/{id} | PATCH /api/parley-rooms/{id} | RoomResource Update (admin) |
| 9 | DELETE /parley/admin/rooms/{id} | DELETE /api/parley-rooms/{id} | RoomResource Delete (admin) |
| 10 | POST /parley/admin/rooms/order | same URL → `ReorderRoomsController` | action: bulk reorder, one CASE update (core does the same with OrderTagsController) |
| 11 | POST /parley/admin/rooms/{id}/image[?variant] | same URL → `SetRoomImageController` | action: multipart upload |
| 12 | DELETE /parley/admin/rooms/{id}/image | same URL → `RemoveRoomImageController` | action: removes a stored file |
| 13 | GET /parley/conversations?filter&offset | GET /api/parley-conversations?filter[inbox]=all\|archived\|requests (+ filter[unread], [group], [mentioned], [pinned], [starred], [muted])&page[offset]&include=lastMessage | ConversationResource Index |
| 14 | POST /parley/conversations {userId} | POST /api/parley-conversations?include=recentMessages,lastMessage with relationships.users = [1 user], isGroup = false | ConversationResource Create (pair) |
| 15 | GET /parley/conversations/{id}[?before\|after\|around] | GET /api/parley-conversations/{id}?include=recentMessages,lastMessage. Paging: GET /api/parley-messages?filter[conversation]=ID&filter[before\|after\|around]=MID | ConversationResource Show and MessageResource Index |
| 16 | POST /parley/conversations/{id}/messages | POST /api/parley-messages | MessageResource Create |
| 17 | POST /parley/conversations/{id}/files | same URL → `UploadFileController` | action: multipart upload |
| 18 | GET /parley/conversations/{id}/details?tab&before | members: GET /api/parley-participants?filter[conversation]=ID. media/files/links: GET /api/parley-messages?filter[conversation]=ID&filter[kind]=media\|files\|links&filter[before]. pins: …&filter[pinned]=1 | ParticipantResource Index and MessageResource Index |
| 19a | POST …/{id}/read | POST /parley/conversations/{id}/read → `MarkReadController` | action: read receipt and push |
| 19b | POST …/{id}/typing | POST /parley/conversations/{id}/typing → `TypingController` | action: ephemeral push |
| 19c | POST …/{id}/hide | PATCH /api/parley-conversations/{id} {hidden: true} | ConversationResource Update |
| 19d | POST …/{id}/mute | PATCH … {muted} (duplicate of settings) | Update |
| 19e | POST …/{id}/accept | PATCH … {request: false} | Update |
| 19f | POST …/{id}/settings | PATCH … {muted, archived, starred, label} | Update |
| 20 | POST /parley/groups | POST /api/parley-conversations {isGroup: true, title, users: [≥2]} | ConversationResource Create (group) |
| 21 | PATCH /parley/conversations/{id} (rename) | PATCH /api/parley-conversations/{id} {title} | Update |
| 22 | POST …/{id}/photo | same URL → `SetGroupPhotoController` | action: multipart upload |
| 23 | DELETE …/{id}/photo | same URL → `RemoveGroupPhotoController` | action: removes a stored file and posts a system message |
| 24 | POST …/{id}/members | same URL → `AddGroupMembersController` | action: batch membership change, one system message, permission check per person |
| 25 | DELETE …/{id}/members/{userId} | same URL → `RemoveGroupMemberController` | action: remove or leave, owner hand-off, last one out deletes |
| 26 | PATCH /parley/messages/{id} | PATCH /api/parley-messages/{id} {body} | MessageResource Update |
| 27 | DELETE /parley/messages/{id} | PATCH /api/parley-messages/{id} {deleted: true} | Update. It's a soft delete (the row stays and renders "deleted"), so JSON:API Delete (204, gone) would be the wrong semantics. This also keeps `api.remove()` returning the message. |
| 28 | POST /parley/messages/{id}/react | same URL → `ReactController` (already single-purpose) | action: toggle |
| 29 | POST /parley/messages/{id}/pin | same URL → `PinMessageController` | action: toggle with push and system message |
| 30 | POST /parley/messages/{id}/forward | same URL → `ForwardMessageController` | action: fan-out send to up to 5 conversations |
| 31 | POST /parley/messages/{id}/report | POST /api/parley-reports {reason, message} | ReportResource Create |
| 32 | GET /parley/files/{id} | same URL → `StreamFileController` (renamed from ImageController) | action: byte-range file streaming |
| 33 | GET /parley/search?q&conversation&from&type&since&until&before | GET /api/parley-messages?filter[q]&filter[conversation]&filter[from]&filter[type]&filter[since]&filter[until]&filter[before]&include=conversation | MessageResource Index |
| 34 | GET /parley/people?q | same URL → `PeopleController` | stays custom: a typeahead over users with Parley's messaging rules (blocks, `canUse`). Core's `users` resource is gated by `searchUsers` and owns the only User searcher, so a second User resource couldn't have its own filters. |
| 35a | POST /parley/people/{id}/follow | same URL → `FollowController` | action: toggle |
| 35b | POST /parley/people/{id}/block | same URL → `BlockController` | action: toggle |
| 36 | GET /parley/reports | GET /api/parley-reports | ReportResource Index (moderators) |
| 37 | POST /parley/reports/{id}/resolve | PATCH /api/parley-reports/{id} {resolved: true} | ReportResource Update (moderators) |

New route names for the actions:
- `ernestdefoe-parley.heartbeat`, `.leave`
- `.rooms.join`, `.rooms.leave`, `.rooms.order`, `.rooms.image.set`, `.rooms.image.remove`
- `.conversations.read`, `.conversations.typing`, `.files.upload`
- `.groups.photo.set`, `.groups.photo.remove`, `.groups.members.add`, `.groups.members.remove`
- `.messages.react`, `.messages.pin`, `.messages.forward`
- `.files.show`, `.people.search`, `.people.follow`, `.people.block`

Removed controllers (WP-9 deletes them): `ConversationsController`, `ShowConversationController`, `ConversationActionController`, `GroupsController`, `MessageController`, `MessageActionController`, `ReportsController`, `RoomsController`, `SearchController`, `DetailsController`, `PersonActionController`, `ImageController`.

---

## (b) Models (new `src/Model/`, all extending `Flarum\Database\AbstractModel` with `ScopeVisibilityTrait`)

AbstractModel already has `$timestamps = false`. The services set dates themselves.

| Model | Table | Casts | Relations |
|---|---|---|---|
| `Conversation` | parley_conversations | id, creator_id, last_message_id, tag_id, parent_id, position: int; is_group, readonly: bool; created_at, updated_at, last_message_at, archived_at: datetime | `participants()` HasMany Participant; `users()` BelongsToMany User via parley_participants (conversation_id, user_id) with pivot role, muted, starred, label, last_read_message_id; `messages()` HasMany Message; `lastMessage()` BelongsTo Message (last_message_id); `creator()` BelongsTo User; `pins()` HasMany Pin |
| `Room extends Conversation` | same table | inherits | global scope `type = 'room'`; `parent()` BelongsTo Room (parent_id); `children()` HasMany Room (parent_id). Visibility scopers are inherited via `class_parents()` (ScopeVisibilityTrait). |
| `Participant` | parley_participants | ints; muted, starred: bool; joined_at, hidden_at, archived_at, requested_at: datetime | `conversation()`, `user()` |
| `Message` | parley_messages | ints; has_link: bool; meta: array; created_at, edited_at, deleted_at: datetime | `conversation()`, `user()`, `replyTo()` BelongsTo Message (reply_to_id), `reactions()` HasMany Reaction, `pin()` HasOne Pin (message_id) |
| `Reaction` | parley_reactions | message_id, user_id: int; created_at: datetime. `$incrementing = false`, `$primaryKey = 'message_id'` (read-only use) | `message()`, `user()` |
| `Pin` | parley_pins | `$primaryKey = 'message_id'`, `$incrementing = false`; created_at: datetime | `message()`, `conversation()`, `user()` |
| `Report` | parley_reports | snapshot: array; created_at, resolved_at: datetime | `message()`, `reporter()`, `reportedUser()` (reported_user_id), `resolvedBy()` |

Follows, blocks and presence get no models. They are only touched by actions (`Relations`, `PresenceStore`).

**Bridge to the builders: `src/Rows.php`.** `Rows::of(object $x): object` returns `$x instanceof Model ? (object) $x->getAttributes() : $x`. That gives the raw, uncast values, exactly what the stdClass rows carry.

Two places must use it, because the models' casts would otherwise break code written for rows:
- `Inbox::summary()` does `(array) $conversation`, which on a model gives protected-property garbage.
- `MessagePayloads` calls `json_decode($r->meta)`, which throws a TypeError on an array cast.

**Visibility (new `src/Access/`, registered with `Extend\ModelVisibility`):**

- **`ScopeConversationVisibility`** (DI: Gate, TagVisibility). The SQL twin of `Conversations::allows()` and `Rooms::canChat()`:
  - If `! $gate->canUse($actor)`, return nothing (`whereRaw('1 = 0')`).
  - Otherwise, either:
    - `type = 'direct'` and a participant row exists for the actor (`whereExists`; aliased through the builder, never raw), or
    - `type = 'room'` and `owner IS NULL` and (actor is admin or `archived_at IS NULL`) and (`tag_id IS NULL` or `tag_id IN TagVisibility::visibleIds($actor)`).
  - Owned rooms never appear. Calls keeps reaching them through `Rooms::canView()`, which is unchanged.
- **`ScopeMessageVisibility`**: `whereIn('conversation_id', Conversation::whereVisibleTo($actor)->select('id'))`.
- **`ScopeParticipantVisibility`**: the conversation is visible and `type = 'direct'` (a room's member list is never listed, as today).
- **`ScopeReportVisibility`**: the actor `hasPermission(Gate::MODERATE)`, otherwise nothing.

---

## (c) Resources (`src/Api/Resource/`, each `new Extend\ApiResource(X::class)`)

### Shared buffer infrastructure (`src/Api/Buffer/`)

- **`RequestBuffer`** (abstract): `WeakMap<ServerRequestInterface, state>`, keyed on `$context->request`. That keeps it per request and per actor, safe in the test process where many requests share one container.
  - `add(Context, Model)` queues an id.
  - `get(Context, Model): array` builds every queued id in one bulk call the first time it's asked, then reads from the cache.
  - `prime(Context, int $id, array $payload)` is for Create responses (so the nonce is echoed).
- **`BufferedField::make(string $schemaClass, string $name, RequestBuffer $buffer, ?string $key = null)`** builds `Schema\X::make($name)->get(fn ($m, $ctx) => $buffer->add($ctx, $m) ?? fn () => $buffer->get($ctx, $m)[$key ?? $name])`.
  - This uses the serializer's deferred-closure support (json-api-server `Serializer` resolves Closures after collecting every resource, as EloquentBuffer does). So primary and included resources are built together in one bulk pass.
- **Concrete buffers:**
  - `MessagePayloadBuffer` → `MessagePayloads::payloads(rows)`
  - `SummaryBuffer` → `Inbox::summariesFor(ids, actor)` with `withLastMessage: false` (lastMessage comes through the relationship, so it isn't built twice)
  - `RoomBuffer` → the per-viewer extras for `listFor`
  - `ParticipantBuffer` → `Groups::members()`-style cards with role and online
  - `ReportBuffer` → `Reports::open()`-style cards

The no-N+1 test (each package): for each Index, the query count with 3 rows equals the query count with 15 rows (`DB::listen` counter).

### `parley-conversations`: `ConversationResource` (model Conversation, about 300 lines)

- **Scope:** visibility only. The inbox slicing is in filters, so a hidden conversation can still be shown and opened.
- **Read attributes** (all `BufferedField` over the summary; names equal today's `ConversationSummary` keys): `type`, `room` (Arr card), `isGroup`, `title`, `imageUrl`, `participants` (Arr of cards with online), `memberCount`, `role`, `lastMessageAt`, `lastReadMessageId`, `seenBy` (Arr), `unread`, `muted`, `archived`, `starred`, `label`, `request`, `mentioned`, `pinCount`.
- **Writable fields:**
  - `isGroup`: Boolean, `writableOnCreate()`, default false.
  - `title`: Str, nullable, `maxLength(Groups::NAME_MAX)`. Writable on create when isGroup. Writable on update only if `is_group && type === 'direct'` and the actor is a participant.
  - `muted`, `archived`, `starred`: Boolean, `writableOnUpdate()` for participants.
  - `label`: Str, nullable, `enum(Conversations::LABELS)`, `writableOnUpdate()`.
  - `hidden`: Boolean, write-only (`visible(false)`), `writableOnUpdate()`, only `true` accepted.
  - `request`: Boolean, `writableOnUpdate()`, only `false` accepted (accepting a request).
- **Relationships:**
  - `lastMessage`: ToOne `parley-messages`, includable. Default include on Index and Show.
  - `recentMessages`: ToMany `parley-messages`, includable, visible only when showing or creating. Its `->get()` returns the latest `Conversations::PAGE` (40) Message models in id order. This follows core's DiscussionResource `posts` relationship, which also uses `->get()`.
  - `creator`: ToOne `users`, linkage only.
  - `users`: ToMany `users`, `writableOnCreate()`, required on create, `visible(false)`. Must use `->set()` to stash the users and a **no-op `->save()`**. Otherwise `AbstractDatabaseResource::saveValue()` calls `BelongsToMany::sync()` and wipes the participants, including the creator.
- **Endpoints** (`authenticated()` on all):
  - `Index` (searcher), `paginate(30, 50)`, `defaultSort('-lastMessageAt')`.
  - `Show`.
  - `Create`. The `create()` override: with `isGroup`, call `Groups::create(actor, ids, title)`; otherwise require exactly one user and call `Conversations::pair(actor, user)`. Return `Conversation::find(row->id)`.
  - `Update`. The `update()` override hands the stashed changes to `ConversationChanges::apply($model, $actor)`, which calls `Conversations::settings / accept / hide` and `Groups::rename`, then refreshes and clears the buffer. Fields' `->set()` writes into `$model->pending[...]`, never to columns.
  - No Delete.
- **Searcher:** `ConversationSearcher::getQuery($actor) = Conversation::whereVisibleTo($actor)->select('parley_conversations.*')`.
- **Filters** (`src/Search/Conversation/`):
  - `InboxFilter` (key `inbox`: all|archived|requests). This is the baseline from `Inbox::listFor`: join `parley_participants as mine` on the actor, `type = direct`, `last_message_id` not null, not hidden (or news since hidden), then the requests/archived split.
  - Each of these is its own class: `UnreadFilter` (`unread`), `GroupFilter` (`group`), `MentionedFilter` (`mentioned`), `PinnedFilter` (`pinned`), `StarredFilter` (`starred`), `MutedFilter` (`muted`). Each depends on the `mine` join, so they require `inbox` and return a 400 without it.
- **Eager loading:** `->eagerLoad(['lastMessage'])`. The cards come from the buffer (`People` singleton bulk load).

### `parley-messages`: `MessageResource` (model Message, about 300 lines)

- **Read attributes** (`BufferedField` over `MessagePayloads`; equal to today's `Message` keys): `conversationId`, `userId`, `author` (Arr card), `type`, `body`, `meta` (Arr), `replyTo` (Arr reference), `reactions` (Arr), `createdAt`, `editedAt`, `deleted`, `pinned`, `nonce` (visible only on the create response).
- **Writable fields:**
  - `body`: Str, `requiredOnCreate()`, `maxLength(Conversations::MAX_LENGTH)`. Writable on update only for the author's own text message that isn't deleted. The service validation stays as defence.
  - `nonce`: Str, `writableOnCreate()`, nullable, `regex('/^[A-Za-z0-9_-]{8,40}$/')`.
  - `replyToId`: Integer, `writableOnCreate()`, nullable, `visible(false)`.
  - `deleted`: Boolean, `writableOnUpdate()`, only `true`, calls `MessageActions::delete`.
- **Relationships:**
  - `conversation`: ToOne `parley-conversations`, `writableOnCreate()`, required on create, includable. Resolved through ConversationResource's scoped `find()`, so you can't post into something you can't see.
  - `user`: ToOne `users`, linkage only. A BelongsTo with no include costs no query.
- **Endpoints:**
  - `Index` (searcher), `paginate(40, 200)`, `defaultSort('-id')`.
  - `Show`.
  - `Create`: `create()` calls `Conversations::send(Rows::of(conversation), actor, 'text', body, null, replyToId, nonce)`, primes the buffer with the returned payload (so the nonce comes back), and returns `Message::find(id)`.
  - `Update`: body → `MessageActions::edit`; deleted → `MessageActions::delete`.
  - No Delete endpoint.
- **Searcher:** `MessageSearcher::getQuery = Message::whereVisibleTo($actor)->select('parley_messages.*')`.
- **Filters** (`src/Search/Message/`):
  - `ConversationFilter` (`conversation`)
  - `BeforeFilter` (`before`: `id < X`)
  - `AfterFilter` (`after`: `id > X`; `setDefaultSort(['id' => 'asc'])`)
  - `AroundFilter` (`around`: requires `conversation`; one query finds the id 20 rows before X, then `id >= bound`, asc)
  - `KindFilter` (`kind`: media = image/video, files = file/voice, links = text + has_link; excludes deleted)
  - `PinnedFilter` (`pinned`: join `parley_pins`, callable default sort by `pins.created_at desc`, excludes deleted)
  - `WordsFilter` (`q`: LIKE or ILIKE, as `Search::matching`)
  - `FromFilter` (`from`), `TypeFilter` (`type`, `Search::TYPES`), `SinceFilter` (`since`), `UntilFilter` (`until`), with the date parsing from `Search::date()`
- **Mutators:**
  - `ScopeUnfilteredSearch`. With no `conversation` filter:
    - require narrowing (q ≥ 2 characters, or type, from, since or until; otherwise `whereRaw('1 = 0')`);
    - restrict to `Conversations::CONTENT` types, not deleted;
    - restrict to conversations the actor participates in. Visibility already drops rooms they can no longer see, which replaces `Search::scope()`'s PHP loop.
  - `RateLimitSearch`: when any of q, from, type, since or until is present, call `RateLimit::hit('search', actor, 30, 60)`. Timeline paging is never rate-limited.
- `Search.php` and `Pins::list()` become unused (WP-9 deletes them).

### `parley-rooms`: `RoomResource` (model Room)

- **Read attributes:** the `Rooms::card()` keys (`name`, `slug`, `description`, `emoji`, `imageUrl`, `imageDarkUrl`, `parentId`, `tagId`, `tagIcon`, `tagColor`, `readonly`, `position`, `archived`, `lastMessageAt`), plus the `RoomBuffer` extras (`children`, `childUnread`, `joined`, `unread`, `members`, `online`), plus **`extra`** (Arr).
  - `extra` holds whatever `RoomRegistry::cardExtenders()` add, for example Calls' `voiceCount` and `voiceUserIds`. It's computed as the extended card minus the base keys. The adapter merges it back flat, so room objects match the heartbeat's.
- **Writable fields (admin):**
  - `name`: Str, `requiredOnCreate()`, `maxLength(80)`.
  - `description`: Str, nullable, `maxLength(300)`.
  - `emoji`: Str, nullable, `maxLength(8)`.
  - `tagId`: Integer, nullable. An attribute, not a relationship, because flarum/tags is optional.
  - `parentId`: Integer, nullable. The one-level rule stays in `Rooms::save`.
  - `readonly`: Boolean.
  - `archived`: Boolean.
  - All `->set()` calls stash into `$model->pending`.
- **Endpoints:**
  - `Index` (searcher), `paginate(200, 500)`, `defaultSort('position')`.
  - `Create`, `Update`, `Delete`, all `->admin()`.
  - `create()` / `update()` call `Rooms::save(null|Rows::of($room), pending)`. `delete()` calls `Rooms::destroy`.
- **Searcher:** `RoomSearcher = Room::whereVisibleTo($actor)`. Owned rooms are already excluded.
- **Filters:**
  - `RailFilter` (`rail`): top level, or joined via a whereExists on participants.
  - `ParentFilter` (`parent`).
  - `ManageFilter` (`manage`): admin only, otherwise nothing; the admin's visibility already includes archived rooms.
  - `children` and `childUnread` are counted among *all* rooms the viewer can see. `RoomBuffer` runs one light query of id and parent_id over the visible set, plus `Inbox::unreadCounts`, as `Rooms::listFor` does today.

### `parley-participants`: `ParticipantResource` (model Participant)

- **Read only:** `role`, `online` (buffer from `PresenceStore::shownOnlineAmong`), `person` (Arr card, `People::card`). Relationship `user` ToOne `users`, linkage only.
- **Endpoints:** `Index`, `paginate(250, 250)`, sorted owner first, then id.
- **Searcher:** `ParticipantSearcher` with `ConversationFilter` (`conversation`, required; without it, nothing).

### `parley-reports`: `ReportResource` (model Report)

- **Read attributes:** `reason`, `createdAt`, `reporter` and `reported` (Arr cards), `snapshot` (Arr with user cards). `ReportBuffer` loads the users in bulk, as `Reports::open()` does.
- **Writable fields:**
  - `reason`: Str, nullable, `maxLength(500)`, `writableOnCreate()`.
  - `resolved`: Boolean, `writableOnUpdate()`, only `true` (calls `Reports::resolve`).
- **Relationships:**
  - `message`: ToOne `parley-messages`, `writableOnCreate()`, required, **never includable or visible**. Moderators must not read conversations; they see only the snapshot.
  - `reporter`, `reportedUser`: ToOne `users`, linkage only.
- **Endpoints:**
  - `Create`: `authenticated()`; `create()` calls `Reports::file(message->id, actor, reason)`. The participant and not-own-message checks stay in the service.
  - `Index`: `->can(Gate::MODERATE)`, no filters (none registered; any `filter[...]` would 400). `scope()` adds `whereNull('resolved_at')` when `$context->listing()`. `defaultSort('-createdAt')`, `paginate(50, 50)`.
  - `Update`: `->can(Gate::MODERATE)`.

---

## (d) Frontend plan: thin adapter in `api.ts` (recommended), not `app.store`

**Adapter: about +450 / −60 lines in 3 files plus 1 test.**
- New `js/src/forum/jsonapi.ts` (about 250 lines). Pure functions with no `app` import, so the node test runner can test them:
  - `indexIncluded(doc)`, `related(doc, rel)`
  - `toMessage(res)`, `toSummary(res, included)` (re-attaches lastMessage), `toRoom(res)` (spreads `extra`), `toMember(res)` (`{...person, role, online}`), `toReport(res)`
  - `body(type, attributes, relationships)`
  - `hasMore(doc)` = `meta.hasMore ?? !!links.next`
- `api.ts` (about 200 lines) keeps **every exported function's name and return type**: `ConversationResponse`, `ConversationListResponse`, `MessageResponse`, `DetailsResponse`, `SearchResponse`, `ReportsResponse`, `RoomsResponse`, `GroupResponse`, `OkResponse`.
- `types.ts` adds about 50 lines of `JsonApiDocument`/`JsonApiResource` types.
- `state.tsx` and the components don't change for the API.
- Lists send `page[total]=0` to skip core's per-request COUNT.

**Store: about 3,000–4,000 lines touched.** Five `Extend.Store` models; `ConvEntry.summary` becomes a Model with method accessors across state and roughly 20 components; pushes (still plain payloads) would need converting to JSON:API before `app.store.pushPayload`. It also **breaks Parley Calls' JS**, which reads `conv.summary.isGroup / participants / type / room / id` and `app.parley.convs`. That violates the hard constraint.

**Why the adapter wins:**
- The push shapes and the UI's types are the contract, and Calls depends on them.
- The adapter contains the change to one file that Floxum's backend finding is about.
- Parity is testable on both sides: PHP, resource attributes equal the builder output; JS, a fixture document round-trips to the same `Message` and `ConversationSummary` objects.

### `api.ts` functions that change

| Function | New call | Adapter result |
|---|---|---|
| `rooms(parent?)` | GET /parley-rooms?filter[rail]=1 or filter[parent]=X | `{rooms}` |
| `conversations(filter, offset)` | GET /parley-conversations?include=lastMessage&page[offset]&page[total]=0 + filter mapping (all → inbox=all; unread → inbox=all&unread=1; groups → inbox=all&group=1; mentions → inbox=all&mentioned=1; pinned, starred, muted likewise; archived → inbox=archived; requests → inbox=requests) | `{conversations, hasMore}` |
| `open(userId)` | POST /parley-conversations?include=recentMessages,lastMessage | `{conversation, messages}` |
| `show(id, params)` | no paging params: GET /parley-conversations/{id}?include=recentMessages,lastMessage. before/after/around: GET /parley-messages?filter[conversation]&filter[x]. `latest` or `after` (the no-realtime poll): both requests in parallel. Same quiet options as today. | `{conversation, messages}` (oldest first; reverses the `-id` pages) |
| `send(id, body, replyToId, nonce)` | POST /parley-messages | `{message}` (nonce echoed) |
| `settings(id, changes)`, `accept(id)` | PATCH /parley-conversations/{id} | `{ok: true}` |
| `action(id, 'read' or 'typing', body)` | unchanged URLs. `'hide'` moves to new `hide(id)`, which PATCHes `{hidden: true}`. `action()` narrows to `'read' \| 'typing'`. | `{ok}` |
| `details(id, tab, before)` | members → participants Index. Pins, media, files, links → messages Index; on the first page of a direct or group conversation, the participants Index runs in parallel. | `{members?, items, hasMore}` |
| `createGroup(userIds, name)` | POST /parley-conversations {isGroup: true} | `{conversation, messages}` |
| `renameGroup(id, name)` | PATCH {title} | `{conversation}` |
| `edit(id, body)` | PATCH /parley-messages/{id} | `{message}` |
| `remove(id)` | PATCH /parley-messages/{id} {deleted: true} | `{message}` |
| `report(id, reason)` | POST /parley-reports | `{ok: true}` |
| `search(params)` | GET /parley-messages?filter[...]&include=conversation&page[total]=0 | `{messages, conversations, hasMore}` |
| `reports()` | GET /parley-reports | `{reports}` |
| `resolve(id)` | PATCH {resolved: true}, then `reports()` | `{reports}` |

**Unchanged:** `joinRoom`, `leaveRoom`, `leave`, `heartbeat`, `upload`, `groupPhoto`, `addMembers`, `removeMember`, `react`, `pin`, `forward`, `people`, `person`, `fileUrl`.

**Admin:** new `js/src/admin/roomsApi.ts` with `list`, `create`, `update`, `remove` over `/parley-rooms` and `toRoom`. `order`, `uploadImage` and `removeImage` keep their URLs. RoomsManager switches to it (WP-8d).

---

## (e) Splits for TD-LONG

### PHP (each new unit under 50 lines; owner in brackets)

- **`Inbox::summaries` (93) [WP-1].** Extract `src/InboxSummaries.php` with:
  - `participantsOf(rows)`
  - `faceIds(byConversation, viewer)`
  - `lastMessagesById(rows)` (skipped when `withLastMessage` is false)
  - `summaryFor(row, parts, viewer)`
  - `othersAndSeen(members, viewer, users, online)`

  `Inbox` keeps `summary`, `summariesFor` (gains `bool $withLastMessage = true`), `unreadCounts`, `inboxState`. `listFor` is deleted (its logic is now InboxFilter plus the searcher).
- **`MessagePayloads::payloads` (54) [WP-2]:** `reactionsFor(ids)`, `pinnedAmong(ids)`, `repliesFor(rows)`, `authorsFor(rows, replies)`, `payload(row, parts)`, `replyRef(reply, authors)`.
- **`Rooms::listFor` (65) [WP-4]:** `visibleRooms(viewer)`, `joinedAmong(ids, viewer)`, `childTallies(all, joined, unread)`, `railRooms(all, joined, parentId)`, `memberAndOnlineCounts(ids)`. `RoomBuffer` reuses the last three.
- **`Groups::create` (56) [WP-4]:** `assertMayCreate(actor)`, `checkedOthers(actor, userIds)` (size, blocks, flood), `insertGroup(actor, others, name)`.
- **`OnlineList::for` (80) [WP-5]:** `presenceRows(viewer, follows)`, `visibleUsers(viewer, ids)`, `classify(user, row, flags)` returning online, offline or skip, `onlineCard(...)`, `offlineCard(...)`, `overflow(rows, rowsByUser)`.
- **`PresenceStore::beat` (79) [WP-5]:** `checkedDiscussion(actor, where, place)`, `checkedRoom(where, place)`, `awaySince(existing, status, now)`, `upsertRow(key, row)`, `pruneSometimes()`, `changeKind(existing, member, status, place, ids)`.
- **`Images::keep` (51) [WP-5]:** `assertAcceptable(upload, kind)`, `storeAs(bytes, ext)`, `metaFor(kind, path, seconds)`.
- **`Tags/FlarumTags::whoCanSee` (54) [WP-5]:** `grantingGroups(tagId)`, `restrictedChain(tagId)`, `usersWith(users, groupIds)`.
- **`Api/ImageController::respond` (57) [WP-3]:** becomes `StreamFileController` plus `src/Api/FileResponse.php` (`headersFor(message, file, meta)`, `ranged(response, stream, size, rangeHeader)`, `parseRange(header, size)`).
- **Tests [WP-7 / WP-5]:**
  - `RoomsUploadsAndPushesTest::pushes_go_through_the_queue_and_a_failing_daemon_is_only_logged` (59) → `arrangeQueue()`, `assertQueued()`, `assertDaemonFailureLogged()`.
  - `ImportRamonTest::sourceTables` (57) and `ImportGroupMessagesTest::sourceTables` (61) → one builder per source table.
- **New resources:** `fields()` = `[...summaryFields(), ...settingFields(), ...relationshipFields()]`; `endpoints()` = `[...readEndpoints(), ...writeEndpoints()]`.
- **Files:** no PHP file is over 600 today (the largest is `Conversations.php` at 527). Keep `Conversations.php` untouched apart from WP-9 deleting `messages()` if nothing uses it.

### TypeScript (over 50 lines → new units)

**`state.tsx` (1360 lines; constructor 69) [WP-8a].**
- `ParleyState` stays the `app.parley` class with every public method. Calls uses `beat`, `callsInstalled`, `config`, `isVisible`, `openRoom`, `room`, `socketUp`, `convs`, `openWith`; components use the rest.
- Bodies move to modules under `js/src/forum/state/` as functions `(s: ParleyState, …)`. The class keeps 1–3-line delegators.
- Fields move to TS property initialisers, so the constructor is about 8 lines (`restore()`, `restoreDrafts()`).

| Module | Functions | Approx. lines |
|---|---|---|
| `presence.ts` | `start`, `status`, `setStatus`, `where`, `activeRoom`, `touchRoom`, `beat`, `moved`, `placeKey`, `watchIdle`, `presenceChanged`, `applyHeartbeat`, `checkApiVersion` | ~220 |
| `realtime.ts` | `bindRealtime`, `socketUp`, `onChannel`, `received`, `arrived`, `changed`, `readBy`, `typingFrom`, `sweepTyping`, `pollOpen` | ~230 |
| `conversations.ts` | `conv`, `remember`, `card`, `ensure`, `refresh`, `forget`, `listChanged`, `load`, `openWith`, `older`, `applyUnread`, `file`, `accept`, `pin`, `forward`, `createGroup`, `groupChanged`, `leaveGroup`, `edit`, `remove`, `react`, `typing`, `markRead`, `hide`, `search`, `follow`, `block`, `person`, `presenceOf` | ~280 |
| `queue.ts` | `send`, `drawPending`, `attempt`, `markPending`, `retry`, `discard`, `flushQueue`, `saveQueue`, `restoreQueue`, `redrawPending`, `upload`, `setDraft`, `restoreDrafts` | ~230 |
| `windows.ts` | `expand`, `openAt`, `select`, `show`, `fit`, `toHead`, `toggleMinimised`, `close`, `isVisible`, `isMobile`, `railDocked`, `toggleRail`, `pinRail`, `key`, `save`, `restore` | ~200 |
| `rooms.ts` | `room`, `loadChildren`, `toggleRoomGroup`, `isRoom`, `openRoom`, `leaveRoom` | ~90 |
| `counts.ts` | `onlineCount`, `totalUnread`, `isMuted`, `onInbox` | ~40 |

`state.tsx` ends at about 450 lines (fields, delegators, types).

**`MessageList.tsx` (718; view 144, bubble 94, menu 85) [WP-8b].**
- `MessageList.tsx` (about 280) keeps lifecycle, scroll, press, `view()` → `rows(conv)`, `dayRow`, `newDivider`.
- New `MessageBubble.tsx` (bubble → `bubbleBody`, `bubbleMeta`, `media`, `fileChip`, `replyQuote`; chips, pendingLine, seen).
- New `MessageMenu.tsx` (`menuItems(msg, mine): ItemList` split into `ownItems`, `moderationItems`, `shareItems`; plus the reaction tray).
- New `CallRow.tsx`, `VoicePlayer.tsx` (moved as is), and `dayLabel()` in `util.ts`.

**`ChatWindow.tsx` (view 84, searchBar 57) [WP-8b].**
- `view()` → `windowClasses`, `header`, `body`, `bottom`.
- New `ChatSearchBar.tsx`, and `ChatBars.tsx` (`requestBar`, `reportBar`, `pinBar`).
- `headerItems(items, conv)` and `bodyTopItems(items, conv)` stay on `ChatWindow.prototype` with the same signatures; Calls extends them.

**`Composer.tsx` (view 153) [WP-8b]:** `ComposerTools.tsx` (attach, emoji and record buttons), `MentionList.tsx`, `ReplyEditBanner.tsx`. `view()` composes them.

**`InboxPage.tsx` (665; view 67, listColumn 67, searchResults 94) [WP-8c].**
- `InboxPage.tsx` (about 300): lifecycle, fetch, filter, `view()` → `columns()`.
- New `InboxList.tsx` (listColumn, listBody, item, itemMenu, roomsList, stillBelongs).
- New `InboxSearch.tsx` (searchMessages, searchResults → `filters`, `resultGroups`, `resultRow`).
- New `ReportsList.tsx`.

**Other components [WP-8c]:**
- `Details.tsx` (view 161, tabBody 61): `DetailsHeader.tsx`, `DetailsMembers.tsx`, `DetailsTabs.tsx` (tabBody → `mediaGrid`, `fileRows`, `linkRows`, `pinRows`).
- `Rail.tsx` (view 99): `railHeader`, `searchResults`, `sections`.
- `Parley.tsx` (oncreate 88, clearCorner 80): `layout/corner.ts` (`measureCorner`, `avoidFloating`, `applyOffsets`); oncreate → `bindResize`, `bindKeys`, `bindRoutes`.
- `NewConversationModal` content (85): `pickedChips`, `searchField`, `resultsList`, `nameField`.
- `ForwardModal` content (53): `targetList`, `targetRow`.
- `RoomRow` view (59): `badge`, `counts`.
- `PersonRow.actionItems` (54): keep the method (Calls extends it); its body calls `messageItems`, `followItems`, `moderationItems`.
- `index.tsx` initializer (about 115): `mountParley()`, `extendUserControls()`, `extendDestructiveControls()`, `extendPrivacySettings()` in new `js/src/forum/extenders.tsx`. The initializer body becomes 5 calls.

**Admin [WP-8d]:** `RoomsManager.tsx` (view 168, editor 76) → `RoomTree.tsx` (tree, tile, drag order), `RoomEditor.tsx` (form fields split `identityFields`, `placementFields`, `imageFields`), `roomsApi.ts`.

Target: every TS function under 50 lines and every file under 600. Re-run the awk length scan from WP-9 to confirm.

---

## (f) Parley Calls impact

**Required changes in Calls: none.** Checked against `/Users/ernestdefoe/github/parley-calls`:

**PHP**
- `CallsController`, `VoiceController` and `UsageController` extend `Ernestdefoe\Parley\Api\Controller` and use `respond()`, `member()`, `input()`, `routeId()`, `query()`. The class, its protected API, `withGate()` and the `ParleyServiceProvider` `afterResolving` hook are **kept**. Only its docblock changes, from "plain JSON" to "action endpoints".
- Service calls stay: `Conversations::find` (still returns a row), `participantIds`, `requestedIds`, and `send(object $conversation, …)` still accepts the stdClass row Calls reads at `Calls.php:359`.
- Also unchanged: `Rooms::find`, `canView`, `postRefusal`, `Rooms::$cardExtenders` (still applied in `listFor`, `all` and RoomResource `extra`), `People::card`, `PresenceStore::statusOf`, `Gate::canUse` / `refusal`, `Broadcaster::toUsers`, `toEveryone`, `available`.
- No table or column changes. Calls reads `parley_conversations` and its own tables directly.
- Calls' routes `/api/parley/calls*` and `/api/parley/voice*` don't clash with `/api/parley-*` resources or the kept `/api/parley/...` actions.

**JS**
- Calls imports `ChatWindow` (extends `headerItems` and `bodyTopItems`, signature `(items, conv)`), `PersonRow` (`actionItems(items, p)`), `Avatar`, `RoomTile`. All kept at the same paths and with the same signatures.
- Calls uses `app.parley.{beat, callsInstalled, config, isVisible, openRoom, room, socketUp, convs, openWith}`. All kept, because the adapter preserves `ConvEntry.summary` fields (`id`, `isGroup`, `participants[].id`, `type`, `room`).
- Room objects keep `voiceCount` and `voiceUserIds`: the heartbeat is unchanged, and RoomResource `extra` is merged flat.
- Push payloads are unchanged.

**Composer:** no `conflict` needed. Release as Parley 1.N (minor). It stays 1.x because Calls requires `^1.9`.
- Guard rule for implementers: if any package finds it must change `Api\Controller`'s protected API or one of the service signatures above, stop. The fix then goes readers-first:
  1. Ship Calls first, tolerant of both forms.
  2. Then Parley, adding `"conflict": {"ernestdefoe/parley-calls": "<X.Y"}` where X.Y is that Calls release.
- WP-9 adds `tests/integration/api/CallsContractTest.php`, which asserts the above (reflection on `Api\Controller` methods; `send()` with a stdClass row; a card extender's key reaching `GET /api/parley-rooms` as `extra` and the heartbeat's rooms).

Separately, Calls' own `CallsController` and `VoiceController` dispatch by route name. That's Calls' TD-DISPATCH, out of scope here.

---

## (g) Work packages (disjoint file ownership)

**Rules for all packages:**
- `js/dist` is built **only** by WP-9; CI fails on a mismatch until then.
- Only WP-0 edits `extend.php` and `locale/en.yml`.
- Phase B packages write **new** test files only; the existing test files belong to WP-7.

### Phase A (serial)

**WP-0 Foundation**
- **Owns:**
  - `src/Model/*` (7 models), `src/Access/*` (4 scopers), `src/Rows.php`
  - `src/Api/Buffer/RequestBuffer.php`, `src/Api/Buffer/BufferedField.php`
  - Compiling **skeletons** that Phase B fills: 5 resources (type, model, empty endpoints and fields), 4 searchers, every filter and mutator class listed in (c) with key and empty body, and `src/Api/Resource/ConversationChanges.php`
  - **Final `extend.php`:** `Extend\ApiResource` ×5, `Extend\ModelVisibility` ×4, `Extend\SearchDriver(DatabaseSearchDriver::class)` with all searchers, filters and mutators, and the full action route list from (a) by class-name string (handlers are resolved lazily per request, so WP-3 can create them later)
  - `locale/en.yml` (reserve any new keys, for example `api.reload_needed`)
  - `tests/integration/JsonApiRequests.php` (trait: `jsonApi($method, $url, $type, $attrs, $rels, $actorId)` and `included($doc, $type)`)
- **Tests:** `tests/integration/models/ModelsTest.php` (casts and relations on a prefixed SQLite database); `tests/integration/models/VisibilityTest.php`, a matrix of stranger / participant / tag-hidden room / archived room (member vs admin) / owned room / user without `canUse`, comparing `Conversation::whereVisibleTo()` with `Conversations::canSee()` for every case.

### Phase B (parallel, after WP-0)

**WP-1 Conversations resource**
- **Owns:** `ConversationResource.php`, `ConversationChanges.php`, `src/Api/Buffer/SummaryBuffer.php`, `src/Search/Conversation/*`, `src/Inbox.php`, new `src/InboxSummaries.php`.
- **Tests (new):** `tests/integration/api/resources/ConversationResourceTest.php`
  - every inbox folder and flag filter matches the old `Inbox::listFor` result for the same fixture
  - pair create is idempotent and lands in Requests
  - group create (≥2 users; one user with isGroup → 422)
  - `users` doesn't sync away the creator
  - `title`, `muted`, `archived`, `starred`, `label`, `hidden`, `request` updates and their `conversationChanged` push
  - stranger gets 404 on Show; a non-member can't PATCH
  - parity: Show attributes equal `Inbox::summary()` (minus `lastMessage`)
  - query count is the same for 3 and 15 conversations

**WP-2 Messages resource**
- **Owns:** `MessageResource.php`, `src/Api/Buffer/MessagePayloadBuffer.php`, `src/Search/Message/*`, `src/MessagePayloads.php`, `src/Search.php` (delete at the end of this package once the filters reproduce it).
- **Tests (new):** `MessageResourceTest.php`, `MessageSearchTest.php`
  - before / after / around / latest windows match `Conversations::messages()` for the same fixture
  - kind and pinned filters match `DetailsController`
  - search covers the joined-rooms-only rule, a tag-hidden room's words never matching, narrowing, 2-character minimum, LIKE escaping, pgsql ILIKE, the rate limit only on search
  - create: nonce echo and idempotency, flood limit, replyTo from another conversation dropped, posting into a hidden room → 404
  - update: body (own only), deleted (own, or room moderator)
  - parity: attributes equal `MessagePayloads::payloads()`
  - query count is the same for 5 and 40 messages

**WP-3 Action handlers**
- **Owns** `src/Api/`:
  - `HeartbeatController` (leave branch removed, adds `apiVersion`), `LeaveSiteController`
  - `MarkReadController`, `TypingController`
  - `JoinRoomController`, `LeaveRoomController`, `ReorderRoomsController`, `SetRoomImageController`, `RemoveRoomImageController`
  - `SetGroupPhotoController`, `RemoveGroupPhotoController`, `AddGroupMembersController`, `RemoveGroupMemberController`
  - `ReactController`, `PinMessageController`, `ForwardMessageController`
  - `FollowController`, `BlockController`
  - `StreamFileController` and `FileResponse.php`
  - `UploadFileController`, `PeopleController`
  - The controller docblock in `Controller.php`
- Each is under 50 lines, one route, one service call, and returns the same plain shape as today.
- **Tests (new):** `tests/integration/api/actions/ActionHandlersTest.php`, one test per route covering auth, privacy 404 and response shape. Byte-range cases (206 / 416 / suffix range) move here from the old file tests.

**WP-4 Rooms, Reports and Participants resources**
- **Owns:** `RoomResource.php`, `ReportResource.php`, `ParticipantResource.php`, `src/Api/Buffer/{RoomBuffer,ReportBuffer,ParticipantBuffer}.php`, `src/Search/{Room,Participant}/*`, `src/Rooms.php`, `src/Reports.php`, `src/Groups.php`.
- **Tests (new):** `RoomResourceTest.php`, `ReportResourceTest.php`, `ParticipantResourceTest.php`
  - rail and parent lists equal `Rooms::listFor`
  - `extra` carries a fake card extender's keys
  - manage list: admin only; a member gets nothing
  - room create, update, delete (admin only; `parentId` stays one level)
  - reports: non-moderator gets 403 on Index; a participant can create; reporting your own message → 404; a duplicate open report → 422; `message` is never in the output
  - participants: room → empty; stranger → empty; owner first
  - query counts

**WP-5 Non-API long functions**
- **Owns:** `src/OnlineList.php`, `src/PresenceStore.php`, `src/Images.php`, `src/Tags/FlarumTags.php`, `tests/integration/console/*`.
- **Tests:** the existing heartbeat, online, tag and console tests must pass unchanged. Run the full suite; behaviour must not change.

**WP-6 Frontend adapter.** Can start in Phase B: it only needs the contract in (c).
- **Owns:** `js/src/forum/api.ts`, `js/src/forum/jsonapi.ts` (new), `js/src/forum/types.ts`, `js/tests/jsonapi.test.mjs` (new).
- Adds `api.hide()` and narrows `action()` to read and typing, but keeps `action(id, 'hide')` working until WP-8a lands.
- **Tests:** fixture JSON:API documents shaped as in (c) map to objects deep-equal to the current payload fixtures; `npm run check-typings`.

### Phase C (after Phase B)

**WP-7 Existing test migration**
- **Owns:** `tests/integration/api/{ParleyTest,Parley2Test,HardeningTest,RoomsUploadsAndPushesTest,SearchTest,TagRoomsTest,RoomAudienceTest,StorageAndUpkeepTest}.php`.
- Rewrite the CRUD and list calls to the new URLs and bodies using the `JsonApiRequests` trait. Action URLs are unchanged. Split the 59-line test.
- `composer test` must pass on SQLite with a prefix and on MySQL. Run PHPStan.

### Phase D (parallel, after WP-6)

- **WP-8a state split.** Owns `js/src/forum/state.tsx` and `js/src/forum/state/*`. Switches `hide` to `api.hide`; adds the `apiVersion` check. Test: typings, `npm test`, and `tools/parley2-e2e.mjs`.
- **WP-8b chat components.** Owns `MessageList.tsx`, `ChatWindow.tsx`, `Composer.tsx` and their new files from (e). Test: typings, e2e, and a check that a stub extender on `ChatWindow.prototype.headerItems` and `bodyTopItems` still renders.
- **WP-8c inbox and shell.** Owns `InboxPage.tsx`, `Details.tsx`, `Rail.tsx`, `Parley.tsx`, `NewConversationModal.tsx`, `ForwardModal.tsx`, `RoomRow.tsx`, `PersonRow.tsx`, `index.tsx`, `extenders.tsx` and the new files from (e). Same tests, plus a check that the `PersonRow.prototype.actionItems` extension still works.
- **WP-8d admin rooms.** Owns `js/src/admin/components/*`, `js/src/admin/roomsApi.ts`. Test: typings, and manual admin create, edit, reorder and image in `tools/shots.mjs`.

### Phase E (serial)

**WP-9 Integration and cleanup**
- Delete the 12 old controllers; delete `Pins::list()`, and `Conversations::messages()` if unused (grep Calls first: it's unused there).
- Add `CallsContractTest`.
- Update the README and CLAUDE.md API notes.
- `cd js && npm run build` and commit dist.
- Run the awk function and file-length scan, PHPStan, both database suites, Calls' suite against this branch (`composer config repositories.parley path ../parley`, read-only check), e2e in two Chromes, and screenshots light and dark.
- Run `pre-floxum`.

---

## (h) Risks

1. **Table prefix with aliases** in filters and visibility (`mine`, `p`, `pins`). Use only builder columns, never `selectRaw('alias.col')`. Run every new test on prefixed SQLite and MySQL (CLAUDE.md trap).
2. **Visibility drift** between the SQL scopes and PHP `Rooms::canView()` / `Conversations::allows()`: canUse, owned rooms, archived for admin, tag visibility via `TagVisibility::visibleIds`. WP-0's matrix test pins it.
3. **Shape drift** between pushes and JSON:API. Prevented by building attributes from the same builders, with PHP parity tests and the JS adapter fixture test.
4. **`users` ToMany sync wiping participants** on Create. A no-op `->save()` is mandatory, with a test (WP-1).
5. **`endpoints()` without a constructor.** Injected services are only allowed inside closures, or routing breaks at boot.
6. **Unknown `filter[...]` on a resource without a searcher** hits the `final filters()` and throws (500, not 400). ReportResource Index must take no filters; every filtered Index needs a registered searcher.
7. **COUNT cost:** Index counts the total unless `page[total]=0`. The adapter always sends it for lists and search.
8. **Extra round trips:** the no-realtime poll (show plus messages-after) and the details first page (messages plus participants) become two parallel requests where there was one. Acceptable: the poll only runs without realtime.
9. **Stale tabs after deploy** (no aliases): 404 until reload. Queued sends are kept (failed, with Retry). `apiVersion` handles future migrations. Fallback is legacy aliases for one release.
10. **Privacy leaks through relationships:** report `message` must stay non-includable; participant listing must be empty for rooms; message `conversation` includes only exist for visible messages.
11. **Rate limit placement:** search's 30/minute must not hit timeline paging (mutator only fires on search filters).
12. **Deferred buffer correctness:** buffers are keyed on the request object (WeakMap), so they're per actor and per request. A shared singleton cache would leak one viewer's summary to another in the test process or a long-running worker.
13. **Floxum residue:** action handlers return plain JSON (allowed, each with a reason in its docblock). People search stays custom (reason in (a)). Services keep query-builder writes (allowed; models are the read side). Possible low-severity notes only.
14. **`js/dist` conflicts:** parallel packages must not build dist; only WP-9 does.
15. **Calls:** any change to `Api\Controller`'s protected API or the listed service signatures breaks Calls silently at runtime. `CallsContractTest` catches it; if a change is truly needed, follow the readers-first plus `conflict` plan in (f).

### Critical files for implementation
- /Users/ernestdefoe/github/parley/extend.php
- /Users/ernestdefoe/github/parley/src/Inbox.php
- /Users/ernestdefoe/github/parley/src/MessagePayloads.php
- /Users/ernestdefoe/github/parley/js/src/forum/api.ts
- /Users/ernestdefoe/github/parley/js/src/forum/state.tsx

Flarum references:
- /Users/ernestdefoe/github/parley/vendor/flarum/core/src/Api/Resource/AbstractDatabaseResource.php
- /Users/ernestdefoe/github/parley/vendor/flarum/core/src/Api/Endpoint/Index.php
- /Users/ernestdefoe/github/parley/vendor/flarum/core/src/Api/Resource/UserResource.php (custom `Endpoint\Endpoint` precedent)
- /Users/ernestdefoe/github/parley/vendor/flarum/core/src/Api/Resource/DiscussionResource.php (`posts` relationship precedent)

Calls touchpoints:
- /Users/ernestdefoe/github/parley-calls/src/Calls.php
- /Users/ernestdefoe/github/parley-calls/js/src/forum/index.js