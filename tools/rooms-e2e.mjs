// Rooms + live presence, end to end, against a LOCAL forum with realtime.
//
//   node tools/rooms-e2e.mjs <tokens-file> [base-url]
//
// <tokens-file> lines: `roomadmin <id> <token>`, `roomqa1 …`, `roomqa2 …`, and
// `stafftag <tag id>` naming a tag members cannot see. Needs puppeteer-core.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PUPPETEER_FROM || '/Users/ernestdefoe/github/convoro2/');
const puppeteer = require('puppeteer-core');

const BASE = process.argv[3] || 'http://localhost:8091';
const lines = fs.readFileSync(process.argv[2] || 'room-tokens.txt', 'utf8').trim().split('\n').map((l) => l.split(' '));
const tok = Object.fromEntries(lines.filter((l) => l.length === 3).map(([n, id, t]) => [n, { id: +id, t }]));
const staffTag = +(lines.find((l) => l[0] === 'stafftag') || [])[1];
const out = [];
const check = (n, ok, d = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const contexts = {};
async function open(u) {
  const ctx = (contexts[u] = await browser.createBrowserContext());
  await ctx.setCookie({ name: 'flarum_remember', value: tok[u].t, domain: new URL(BASE).hostname, path: '/' });
  const p = await ctx.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  p.on('pageerror', (e) => out.push(`PAGEERROR ${u}: ${e.message}`));
  await p.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => window.app && app.parley && app.parley.loaded, { timeout: 20000 });
  return p;
}
const api = (p, method, path, body) => p.evaluate(async (method, path, body) => {
  try { return await app.request({ method, url: app.forum.attribute('apiUrl') + path, body, errorHandler: () => {} }); }
  catch (e) { return { error: e.response?.errors?.[0]?.detail || e.status || String(e) }; }
}, method, path, body);
const wait = (p, fn, a, t = 10000) => p.waitForFunction(fn, { timeout: t, polling: 200 }, a).then(() => true, () => false);

try {
  const admin = await open('roomadmin');
  const made = {};
  for (const [key, body] of Object.entries({
    lounge: { name: 'QA Lounge', emoji: '🏈', description: 'Talk about anything' },
    news: { name: 'QA News', emoji: '📣', readonly: true },
    staff: { name: 'QA Staff Room', emoji: '🛡️', tagId: staffTag },
  })) made[key] = (await api(admin, 'POST', '/parley/admin/rooms', body)).room;
  check('admin creates three rooms', made.lounge?.id && made.news?.id && made.staff?.id);

  const A = await open('roomqa1');
  await A.evaluate(() => app.parley.beat());
  await sleep(800);
  const seen = await A.evaluate(() => app.parley.rooms.map((r) => r.name));
  check('member sees the lounge and news', seen.includes('QA Lounge') && seen.includes('QA News'), JSON.stringify(seen));
  check('member does NOT see the staff room', !seen.includes('QA Staff Room'));
  const peek = await api(A, 'GET', `/parley/conversations/${made.staff.id}`);
  check('the staff room cannot be fetched by id either', !!peek.error, JSON.stringify(peek).slice(0, 80));

  // ── Live presence: B arrives, A's list updates without waiting 30s ──
  const before = await A.evaluate(() => app.parley.online.some((p) => p.username === 'roomqa2'));
  const t0 = Date.now();
  const B = await open('roomqa2');
  const arrived = await wait(A, () => app.parley.online.some((p) => p.username === 'roomqa2'), null, 9000);
  check('B arriving shows in A\'s list within seconds', !before && arrived, `${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // ── Room chat ──
  await A.evaluate((id) => app.parley.openRoom(id), made.lounge.id);
  await B.evaluate((id) => app.parley.openRoom(id), made.lounge.id);
  await sleep(1000);
  await A.evaluate((id) => app.parley.send(id, 'Kickoff in ten, @roomqa2 you in?'), made.lounge.id);
  check('B receives the room message live', await wait(B, (id) => (app.parley.conv(id)?.messages || []).some((m) => m.body.startsWith('Kickoff')), made.lounge.id));
  await B.evaluate(() => m.redraw.sync());
  check('B sees A\'s name over the bubble', await B.evaluate(() => [...document.querySelectorAll('.pl-author')].some((e) => e.textContent === 'roomqa1')));
  check('the mention is highlighted', await B.evaluate(() => !!document.querySelector('.pl-mention')));
  const notes = await api(B, 'GET', '/notifications');
  check('B got a mention alert', (notes.data || []).some((n) => n.attributes.contentType === 'parleyRoomMention'));
  check('room header shows the tile and counts', await B.evaluate((id) => { m.redraw.sync(); const w = [...document.querySelectorAll('.pl-win')].find((x) => x.textContent.includes('QA Lounge')); return !!(w && w.querySelector('.pl-room-tile') && /online|member/.test(w.querySelector('.pl-st').textContent)); }, made.lounge.id));

  // typing in a room
  await A.evaluate((id) => { app.parley.lastTypingSent = {}; app.parley.typing(id); }, made.lounge.id);
  check('B sees A typing in the room', await wait(B, (args) => !!app.parley.conv(args[0])?.typing?.[args[1]], [made.lounge.id, tok.roomqa1.id], 5000));

  // ── Announcements: member cannot post, admin can ──
  const denied = await api(A, 'POST', `/parley/conversations/${made.news.id}/messages`, { body: 'hello' });
  check('member cannot post in announcements', !!denied.error, denied.error);
  const allowed = await api(admin, 'POST', `/parley/conversations/${made.news.id}/messages`, { body: 'Server maintenance tonight' });
  check('admin can post in announcements', !!allowed.message);
  await A.evaluate((id) => app.parley.openRoom(id), made.news.id);
  await sleep(1200);
  check('member sees the read-only note, not a composer', await A.evaluate(() => { m.redraw.sync(); return !!document.querySelector('.pl-readonly'); }));

  // ── Moderation: admin removes a member's room message ──
  const bMsg = (await api(B, 'POST', `/parley/conversations/${made.lounge.id}/messages`, { body: 'something rude' })).message;
  const removed = await api(admin, 'DELETE', `/parley/messages/${bMsg.id}`);
  check('moderator can remove a room message', removed.message?.deleted === true);
  check('A sees it removed live', await wait(A, (args) => (app.parley.conv(args[0])?.messages || []).some((m) => m.id === args[1] && m.deleted), [made.lounge.id, bMsg.id]));

  // ── B leaves the page: A's list drops B at once ──
  const t1 = Date.now();
  await B.close();
  const gone = await wait(A, () => !app.parley.online.some((p) => p.username === 'roomqa2'), null, 9000);
  check('B leaving disappears from A\'s list within seconds', gone, `${((Date.now() - t1) / 1000).toFixed(1)}s`);

  await A.evaluate(() => { app.parley.sections.rooms = true; m.redraw.sync(); });
  await A.screenshot({ path: 'rooms-rail.png' });

  for (const r of Object.values(made)) await api(admin, 'DELETE', `/parley/admin/rooms/${r.id}`);
  check('rooms cleaned up', ((await api(admin, 'GET', '/parley/admin/rooms')).rooms || []).every((r) => !r.name.startsWith('QA ')));
} catch (e) {
  out.push('ERROR ' + e.stack);
}
console.log(out.join('\n'));
await browser.close();
