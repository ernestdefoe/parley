# Parley — notes for whoever works on this next

Flarum 2 chat: an online list, a messenger page (/parley) modelled on XenForo's
Immersive Messenger, docked mini windows, group conversations, requests, voice
notes and files, and the seams Parley Calls (premium, separate repo) hooks into.

🚨 **Flarum's own look** (Ernest, 2026-10-26, Parley 2): core components and
Flarum's CSS variables only, light and dark — no palette or fonts of Parley's
own. This replaced the October mockup rule. The `--pl-*` tokens are aliases of
Flarum's variables because Parley Calls styles itself with them. Check changes
on default Flarum, Bespoke and two Wardrobe themes (Concourse, Masthead), light
and dark, and on the iOS Simulator and Android emulator. Scope:
`~/github/scopes/parley-2/SCOPE.md`.

## Rules

- Commit straight to `main`; subjects are `feat:` / `fix:` (the release drafter bumps from them). No PRs.
- `js/dist` is committed and CI fails if it differs from a fresh build: `cd js && npm run build`, commit both.
- Every string is in `locale/en.yml`. No hardcoded English in JS or PHP.
- Raw SQL skips the table prefix. Use the query builder; never `selectRaw('alias.column')`.
- Anything drawn per person must be built in bulk — the online list runs on every heartbeat of every member.

## Traps already paid for

- The inbox is `/parley`, never `/messages` (flarum/messages owns it; a duplicate route 500s the whole forum).
- Start from `extend(app, 'mount')`; `flarum/forum/ForumApplication` is not a module in Flarum 2.
- flarum/realtime will not authorise an extension's own channels. Push everything to `private-user=<id>`.
- Links inside Parley need `.Parley.Parley` specificity or a theme's link colour wins the tie.
- Do not key some children of a Mithril list and not others — and a `null` hole in a keyed list counts as unkeyed. Give a conditional keyed child its own wrapper.
- An event handler that returns `false` cancels the event in Mithril: `onkeydown={(e) => e.key === 'Escape' && x()}` made a field untypable.
- Flarum 2 modals that submit extend `FormModal`, not `Modal` (plain Modal has no form).
- Lazy chunks need `->jsDirectory(__DIR__.'/js/dist/forum')` in extend.php and the namespaced chunk ids in webpack.config.js. ChatWindow stays in the main bundle (Parley Calls imports and extends it); its body (MessageList, Composer) is the ChatBody chunk.
- On touch screens anything shown on `:hover` costs iOS a tap: hover styles go under `@media (hover: hover)`. Fields under 16px make iOS zoom.
- Size the messenger by its own width (container queries on `.pl-shell`), not the window: themes add side columns.
- "Online" shown to others comes from `PresenceStore::shownOnlineAmong()` (leaves out Appear offline); `onlineAmong()` is only for deciding whether to alert.
- Rooms have `is_group = 1` too: a group conversation is `type = direct AND is_group`.
- The release version stays 1.x: Parley Calls requires `ernestdefoe/parley ^1.5`, so a 2.0.0 would not install beside it.

## Testing

- `composer test` (SQLite with a prefix, or MySQL — both pass), PHPStan, `cd js && npm test`.
- `tools/parley2-e2e.mjs` clicks through every Parley 2 flow in two headless Chromes (fake mic); `tools/shots.mjs` screenshots desktop and phone, light (`THEME=dark` for dark).
