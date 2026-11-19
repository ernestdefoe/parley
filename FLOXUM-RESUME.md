# Floxum wave: Parley rewrite (paused 2026-11-19, resume after the weekly reset on Nov 26)

Ernest paused rewrites ("Yes, pause rewrites"). 1.11.1 shipped every fix except the four findings below.

## Still open (pre-floxum on 1.11.1: 70 if all are charged, about 94 expected)

1. **FC-CUSTOM-API (medium).** The CRUD/list endpoints are PSR-15 controllers. Move them onto Flarum 2 JSON:API resources (models + AbstractDatabaseResource). The design is in FLOXUM-REWRITE-DESIGN.md (added when the planning agent finished; if it's missing, regenerate it).
2. **TD-DISPATCH (medium).** Several controllers branch on route name, method or `{action}`. Give each remaining action route its own handler.
3. **TD-LONG, functions (medium).** About 30 functions are over 50 lines: the view()s of RoomsManager, Details, Composer and MessageList; state.tsx; Inbox::summaries. Full list in FLOXUM-PREFLOXUM-2026-11-19.json.
4. **TD-LONG, files (medium).** Files over 600 lines: js/src/forum/state.tsx (~1360), MessageList.tsx (~718), InboxPage.tsx (~665).

## Constraints

- **Keep Parley Calls working.** It extends Api\Controller, calls Conversations::send/find/participantIds/requestedIds, uses the Broadcaster and Rooms, and imports ChatWindow, PersonRow, Avatar and RoomTile.
- **Calls change, readers first.** In VoiceServiceProvider, switch `Rooms::$cardExtenders[] = …` to `RoomRegistry::addCardExtender()`. Then add a composer `conflict` for old versions.
- **Test everywhere.** SQLite, MySQL and PostgreSQL (confirm the driver in vendor/flarum/testing/src/integration/tmp/config.php), plus tools/parley2-e2e.mjs on ~/Herd/parley-shots.
- **One release.** The Command Center reviews it before the tag.
