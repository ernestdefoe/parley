# Parley — notes for whoever works on this next

Flarum 2 chat: an online list (Battle.net), docked chat windows (Messenger), and
the seams Parley Calls (premium, separate repo) hooks into. The approved design is
`~/github/chat-extension-scope/parley-mockup.html` — **the UI must match it exactly**.

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
- Do not key some children of a Mithril list and not others.
