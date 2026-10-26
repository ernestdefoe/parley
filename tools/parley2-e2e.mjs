/*
 * Parley 2, end to end, by clicking: two members in two browsers.
 *
 *   BASE=http://parley-shots.test TOKENS=tokens.txt node tools/parley2-e2e.mjs
 *
 * TOKENS: lines of "<username> <remember token>" for admin, alice and dan.
 * Needs the members and conversations tools/… seeds: alice, ben, cara, eve,
 * a pending request from dan, and admin ↔ alice.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(process.env.PUPPETEER_FROM || '/Users/ernestdefoe/github/convoro2/');
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE || 'http://parley-shots.test';
const tok = Object.fromEntries(fs.readFileSync(process.env.TOKENS, 'utf8').trim().split('\n').map((l) => l.split(' ')));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  // A .test site over plain http is not a secure context, and a browser
  // offers no microphone there; real forums run on https.
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--unsafely-treat-insecure-origin-as-secure=${BASE}`],
});

const results = [];
const errors = [];
const ok = (name, pass, detail = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  console.log(results[results.length - 1]);
};
const RUN = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(user, url = '/') {
  const ctx = await browser.createBrowserContext();
  await ctx.setCookie({ name: 'flarum_remember', value: tok[user], domain: new URL(BASE).hostname, path: '/' });
  const p = await ctx.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  p.on('pageerror', (e) => errors.push(`${user}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(`${user} console: ${m.text()}`));
  await p.goto(BASE + url, { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => window.app && app.parley && app.parley.loaded, { timeout: 20000 });
  return p;
}
const api = (p, method, url, body) =>
  p.evaluate(
    async (method, url, body) => {
      try {
        return await app.request({ method, url: app.forum.attribute('apiUrl') + url, body, errorHandler: () => {} });
      } catch (e) {
        return { error: e.status };
      }
    },
    method,
    url,
    body
  );
const until = (p, fn, arg, t = 12000) => p.waitForFunction(fn, { timeout: t, polling: 200 }, arg).then(() => true, () => false);
const convWith = (p, username) =>
  p.evaluate(async (u) => {
    const get = (f) => app.request({ url: app.forum.attribute('apiUrl') + '/parley/conversations?filter=' + f });
    const r = { conversations: [...(await get('all')).conversations, ...(await get('requests')).conversations] };
    const c = r.conversations.find((c) => !c.isGroup && c.participants.some((x) => x.username === u));
    return c && c.id;
  }, username);
const type = async (p, text) => {
  await p.click('.pl-win.page textarea');
  await p.keyboard.type(text);
};

try {
  const admin = await open('admin', '/parley');
  const aliceConv = await convWith(admin, 'alice');
  await admin.goto(`${BASE}/parley/${aliceConv}`, { waitUntil: 'networkidle2' });
  await admin.waitForSelector('.pl-win.page textarea');

  // Alice has the same conversation open in a docked window on the home page.
  const alice = await open('alice', '/');
  await alice.evaluate((id) => app.parley.show(id), aliceConv);
  await alice.waitForSelector('.pl-dock .pl-win textarea');

  // 1. Send, and the other side sees it without a reload (polling: no realtime here).
  await type(admin, 'Hello from the e2e run');
  await admin.keyboard.press('Enter');
  ok('send draws at once', await until(admin, () => [...document.querySelectorAll('.pl-win.page .pl-bub')].some((b) => b.textContent.includes('Hello from the e2e run'))));
  ok('send is confirmed', await until(admin, () => !document.querySelector('.pl-win.page .pl-row.pending')));
  ok('the other member receives it live', await until(alice, () => [...document.querySelectorAll('.pl-dock .pl-bub')].some((b) => b.textContent.includes('Hello from the e2e run')), null, 15000));

  // 2. A dropped connection: the message waits, then goes once.
  await admin.setOfflineMode(true);
  await type(admin, `Sent through a network cut ${RUN}`);
  await admin.keyboard.press('Enter');
  ok('offline: shown as waiting', await until(admin, () => !!document.querySelector('.pl-win.page .pl-row.pending'), null, 6000));
  await sleep(2500);
  await admin.setOfflineMode(false);
  await admin.evaluate(() => window.dispatchEvent(new Event('online')));
  ok('back online: delivered', await until(admin, () => !document.querySelector('.pl-win.page .pl-row.pending'), null, 15000));
  const cut = await api(admin, 'GET', `/parley/search?q=${encodeURIComponent('network cut ' + RUN)}&conversation=${aliceConv}`);
  ok('delivered exactly once', cut.messages && cut.messages.length === 1, `found ${cut.messages && cut.messages.length}`);

  // 3. The one-tap like, and emoji from the picker.
  await admin.click('.pl-win.page .pl-like');
  ok('👍 sends in one tap', await until(admin, () => [...document.querySelectorAll('.pl-win.page .pl-bub.pl-big')].some((b) => b.textContent.includes('👍'))));
  await admin.click('.pl-win.page .pl-emoji-btn');
  await admin.waitForSelector('.pl-emoji-grid button');
  await admin.click('.pl-emoji-grid button');
  ok('emoji go into the box', (await admin.$eval('.pl-win.page textarea', (t) => t.value)).length > 0);
  await admin.evaluate(() => {
    const t = document.querySelector('.pl-win.page textarea');
    t.value = '';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 4. Drafts survive leaving the conversation.
  await type(admin, 'An unsent thought');
  const benConv = await convWith(admin, 'ben');
  await admin.evaluate((id) => m.route.set(app.route('parley.conversation', { id })), benConv);
  await sleep(1200);
  ok('the list shows the draft', await until(admin, () => [...document.querySelectorAll('.pl-draft')].length > 0));
  await admin.evaluate((id) => m.route.set(app.route('parley.conversation', { id })), aliceConv);
  await admin.waitForSelector('.pl-win.page textarea');
  ok('the draft comes back', await until(admin, () => document.querySelector('.pl-win.page textarea').value === 'An unsent thought'));
  await admin.evaluate(() => {
    const t = document.querySelector('.pl-win.page textarea');
    t.value = '';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 5. A file through "+".
  const file = path.join(os.tmpdir(), 'parley-e2e-notes.txt');
  fs.writeFileSync(file, 'Notes for Saturday\n');
  await admin.click('.pl-win.page .pl-plus-wrap .pl-ib');
  await admin.waitForSelector('.pl-plus-menu button');
  const [chooser] = await Promise.all([admin.waitForFileChooser(), admin.evaluate(() => document.querySelectorAll('.pl-plus-menu button')[1].click())]);
  await chooser.accept([file]);
  ok('a file sends and shows as a card', await until(admin, () => [...document.querySelectorAll('.pl-win.page .pl-file-name')].some((n) => n.textContent.includes('parley-e2e-notes.txt')), null, 15000));

  // 6. A voice note from the (fake) microphone.
  await admin.click('.pl-win.page button[aria-label="Record a voice note"]');
  ok('recording starts', await until(admin, () => !!document.querySelector('.pl-rec-dot.on'), null, 8000));
  await sleep(2200);
  await admin.click('.pl-recorder .pl-send');
  ok('a voice note sends', await until(admin, () => !!document.querySelector('.pl-win.page .pl-voice-player'), null, 15000));
  const voice = await api(admin, 'GET', `/parley/conversations/${aliceConv}/details?tab=files`);
  const note = voice.items && voice.items.find((x) => x.type === 'voice');
  ok('the voice note is kept with its length', !!note && note.meta.duration >= 1, note ? `${note.meta.duration}s, ${note.meta.mime}` : 'none');
  if (note) {
    const res = await admin.evaluate(async (u) => {
      const r = await fetch(u, { headers: { Range: 'bytes=0-99' } });
      return { status: r.status, type: r.headers.get('content-type'), len: (await r.arrayBuffer()).byteLength };
    }, `${BASE}/api/parley/files/${note.id}`);
    ok('voice notes are served in ranges, as audio', res.status === 206 && /^audio\//.test(res.type) && res.len === 100, JSON.stringify(res));
  }

  // 7. Pin from the message menu, and the pinned bar.
  // Found afresh each time: a redraw can replace a row's element.
  const menu = (label) =>
    admin.evaluate(async (source) => {
      const label = new RegExp(source);
      const row = [...document.querySelectorAll('.pl-win.page .pl-row')].reverse().find((r) => r.textContent.includes('Hello from the e2e run'));
      row.querySelector('.pl-more').click();
      await new Promise((r) => setTimeout(r, 300));
      const button = [...document.querySelectorAll('.pl-msg-menu button')].find((b) => label.test(b.textContent.trim()));
      button.click();
      return button.textContent.trim();
    }, label.source);
  const pinned = await menu(/^(Pin|Unpin)$/);
  if (pinned === 'Unpin') await menu(/^Pin$/);
  ok('pinning shows the pinned bar', await until(admin, () => !!document.querySelector('.pl-pinbar')));

  // 8. Forward to ben.
  await menu(/^Forward$/);
  await admin.waitForSelector('.ParleyForwardModal .pl-forward-row');
  await admin.evaluate(() => [...document.querySelectorAll('.pl-forward-row')].find((r) => r.textContent.includes('ben')).click());
  const picked = await admin.$$eval('.pl-forward-row input:checked', (x) => x.length);
  await admin.click('.ParleyForwardModal button[type=submit]');
  await sleep(1500);
  if (!picked) errors.push('forward: nothing was ticked');
  if (await admin.$('.ParleyForwardModal')) errors.push('forward: modal still open: ' + (await admin.$eval('.ParleyForwardModal', (m) => m.innerText.slice(0, 300))));
  const fwd = await api(admin, 'GET', `/parley/conversations/${benConv}`);
  ok('forwarding lands in the other conversation, marked', fwd.messages.some((x) => x.body === 'Hello from the e2e run' && x.meta && x.meta.forwarded));

  // 9. Search in this conversation.
  await admin.click('.pl-win.page [data-item="search"]');
  await admin.waitForSelector('.pl-findbar input');
  await admin.type('.pl-findbar input', 'bakery');
  await admin.keyboard.press('Enter');
  const found = await until(admin, () => /of/.test(document.querySelector('.pl-find-count')?.textContent || ''));
  ok('search in a chat finds and counts', found, found ? '' : JSON.stringify(await admin.evaluate(async (id) => [document.querySelector('.pl-findbar input')?.value, await app.request({ url: app.forum.attribute('apiUrl') + '/parley/search?q=bakery&conversation=' + id, errorHandler: () => {} }).then((r) => r.messages.length, (e) => 'err ' + e.status)], aliceConv)));

  // 10. Search across chats from the list, by words.
  await admin.click('.pl-list-search input');
  await admin.keyboard.type('Harbour');
  await admin.waitForSelector('.pl-search-all');
  await admin.click('.pl-search-all');
  ok('search across chats finds the group message', await until(admin, () => [...document.querySelectorAll('.pl-hit')].some((h) => h.textContent.includes('Weekend ride'))));
  await admin.evaluate(() => document.querySelector('.pl-hit').click());
  ok('a result opens at the message', await until(admin, () => !!document.querySelector('.pl-row.pl-lit') || /Harbour/.test(document.querySelector('.pl-win.page')?.textContent || '')));
  await admin.evaluate(() => [...document.querySelectorAll('.pl-search-filters .Button--link')].forEach((b) => b.click()));
  await admin.evaluate(() => {
    const i = document.querySelector('.pl-list-search input');
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 11. A new group with chips, a name, then add and remove someone.
  await admin.click('.pl-list-head button');
  await admin.waitForSelector('#Parley-new-to');
  for (const name of ['ben', 'cara']) {
    await admin.type('#Parley-new-to', name);
    await until(admin, (n) => [...document.querySelectorAll('.pl-pick-list button')].some((b) => b.textContent.includes('@' + n)), name);
    await admin.evaluate((n) => [...document.querySelectorAll('.pl-pick-list button')].find((b) => b.textContent.includes('@' + n)).click(), name);
    await until(admin, (n) => [...document.querySelectorAll('.pl-person-chip')].some((c) => c.textContent.includes(n)), name);
  }
  await admin.waitForSelector('#Parley-new-name');
  await admin.type('#Parley-new-name', 'E2E crew');
  await admin.click('.ParleyNewModal button[type=submit]');
  ok('a group is created and opened', await until(admin, () => /E2E crew/.test(document.querySelector('.pl-win.page .pl-nm')?.textContent || '')));
  ok('its first line says who started it', await until(admin, () => /started the group/.test(document.querySelector('.pl-win.page .pl-sys')?.textContent || '')));
  const groupId = await admin.evaluate(() => app.parley.pageConversation);
  const added = await api(admin, 'POST', `/parley/conversations/${groupId}/members`, { userIds: [7] });
  ok('the owner adds someone', added.members && added.members.length === 4, `${added.members && added.members.length} members`);
  const removed = await api(admin, 'DELETE', `/parley/conversations/${groupId}/members/7`);
  ok('…and removes them', removed.members && removed.members.length === 3);

  // 12. Accepting a request moves it to the inbox.
  const danConv = await convWith(admin, 'dan');
  const listed = await api(admin, 'GET', '/parley/conversations?filter=requests');
  ok('the request waits in Requests', listed.conversations.some((c) => c.id === danConv));
  await admin.evaluate((id) => m.route.set(app.route('parley.conversation', { id })), danConv);
  await admin.waitForSelector('.pl-request .Button--primary');
  await admin.click('.pl-request .Button--primary');
  ok('Accept takes the bar away', await until(admin, () => !document.querySelector('.pl-request')));
  const after = await api(admin, 'GET', '/parley/conversations');
  ok('…and it is in the inbox', after.conversations.some((c) => c.id === danConv));

  // 13. Archive from the conversation's menu, then find it under Archived.
  await admin.evaluate((id) => m.route.set(app.route('parley.inbox')), null);
  await sleep(800);
  await admin.evaluate(() => {
    const item = [...document.querySelectorAll('.pl-item')].find((i) => i.querySelector('.pl-nm')?.textContent.trim().startsWith('ben'));
    item.querySelector('.pl-item-menu .Dropdown-toggle').click();
  });
  await sleep(300);
  await admin.evaluate(() => [...document.querySelectorAll('.pl-item-menu.open .Dropdown-menu button')].find((b) => b.textContent.trim() === 'Archive').click());
  ok('archived leaves the inbox', await until(admin, () => ![...document.querySelectorAll('.pl-item .pl-nm')].some((n) => n.textContent.trim() === 'ben')));
  await sleep(1200);
  const arch = await api(admin, 'GET', '/parley/conversations?filter=archived');
  ok('…and is under Archived', arch.conversations.some((c) => c.id === benConv));
  await api(admin, 'POST', `/parley/conversations/${benConv}/settings`, { archived: false });

  // 14. A mini window on another page expands to the messages page.
  await admin.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await admin.waitForFunction(() => app.parley && app.parley.loaded);
  await admin.evaluate((id) => app.parley.show(id), aliceConv);
  await admin.waitForSelector('.pl-dock [data-item="expand"]');
  await admin.click('.pl-dock [data-item="expand"]');
  ok('expand opens the conversation full size', await until(admin, () => location.pathname.endsWith('/parley/' + app.parley.pageConversation) && !!document.querySelector('.pl-win.page')));
} catch (e) {
  ok('script', false, e.message + ' ' + (e.stack || '').split('\n').filter((l) => l.includes('parley2-e2e')).join(' '));
} finally {
  await browser.close();
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  process.exit(failed || errors.length ? 1 : 0);
}
