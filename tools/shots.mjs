/*
 * Screenshots of Parley 2's screens, desktop and phone, light and dark, and
 * every page error met on the way.
 *
 *   BASE=http://parley-shots.test TOKENS=tokens.txt OUT=dir node tools/shots.mjs [only]
 *
 * TOKENS: lines of "<username> <remember token>".
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PUPPETEER_FROM || '/Users/ernestdefoe/github/convoro2/');
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE || 'http://parley-shots.test';
const OUT = process.env.OUT || '/tmp/parley-shots';
const ONLY = process.argv[2] || '';
const THEME = process.env.THEME || 'light';
const tok = Object.fromEntries(fs.readFileSync(process.env.TOKENS, 'utf8').trim().split('\n').map((l) => l.split(' ')));
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const errors = [];

async function page(user, width, height, mobile = false) {
  const ctx = await browser.createBrowserContext();
  await ctx.setCookie({ name: 'flarum_remember', value: tok[user], domain: new URL(BASE).hostname, path: '/' });
  const p = await ctx.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }]);
  p.on('pageerror', (e) => errors.push(`${user} ${width}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/favicon|ERR_/.test(m.text()) && errors.push(`${user} ${width} console: ${m.text()} ${(m.stackTrace() || []).slice(0, 4).map((f) => (f.url || '').split('/').pop() + ':' + f.lineNumber).join(' < ')}`));
  return p;
}
const ready = (p) => p.waitForFunction(() => window.app && app.parley && app.parley.loaded, { timeout: 20000 });
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await settle();
  await p.screenshot({ path: `${OUT}/${THEME}-${name}.png` });
  console.log('shot', name);
};
const want = (name) => !ONLY || name.includes(ONLY);

try {
  if (want('inbox')) {
    const p = await page('admin', 1440, 900);
    await p.goto(BASE + '/parley', { waitUntil: 'networkidle2' });
    await ready(p);
    await shot(p, 'inbox-empty');
    const id = await p.evaluate(() => [...app.parley.convs.values()].find((c) => c.summary.participants.some((x) => x.username === 'alice') && !c.summary.isGroup).summary.id);
    await p.goto(BASE + '/parley/' + id, { waitUntil: 'networkidle2' });
    await p.waitForSelector('.pl-win.page .pl-row');
    await shot(p, 'inbox-chat');
    await p.click('.pl-win.page [data-item="details"]');
    await p.waitForSelector('.pl-details');
    await shot(p, 'inbox-details');
    const g = await p.evaluate(() => [...app.parley.convs.values()].find((c) => c.summary.isGroup).summary.id);
    await p.goto(BASE + '/parley/' + g, { waitUntil: 'networkidle2' });
    await p.waitForSelector('.pl-win.page .pl-row');
    await settle(1500);
    await shot(p, 'inbox-group');
    await p.click('.pl-more-filter .Dropdown-toggle');
    await shot(p, 'inbox-more');
  }

  if (want('dock')) {
    const p = await page('admin', 1440, 900);
    await p.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await ready(p);
    const ids = await p.evaluate(() => {
      const s = app.parley;
      return [...s.convs.values()].map((c) => c.summary.id);
    });
    const list = await p.evaluate(async () => (await app.request({ url: app.forum.attribute('apiUrl') + '/parley/conversations' })).conversations.map((c) => c.id));
    for (const id of list.slice(0, 3)) await p.evaluate((id) => app.parley.show(id), id);
    await p.waitForSelector('.pl-dock .pl-row');
    await settle(1500);
    await shot(p, 'dock');
    void ids;
  }

  if (want('request')) {
    const p = await page('admin', 1440, 900);
    await p.goto(BASE + '/parley', { waitUntil: 'networkidle2' });
    await ready(p);
    await p.click('.pl-more-filter .Dropdown-toggle');
    await settle(300);
    await p.evaluate(() => [...document.querySelectorAll('.pl-more-filter .Dropdown-menu button')].find((b) => b.querySelector('.fa-inbox')).click());
    await settle(1200);
    await p.click('.pl-item .pl-item-link');
    await p.waitForSelector('.pl-request');
    await shot(p, 'request');
  }

  if (want('phone')) {
    const p = await page('admin', 390, 844, true);
    await p.goto(BASE + '/parley', { waitUntil: 'networkidle2' });
    await ready(p);
    await shot(p, 'phone-list');
    await p.click('.pl-item .pl-item-link');
    await p.waitForSelector('.pl-win.page .pl-row');
    await shot(p, 'phone-chat');
  }

  if (want('composer')) {
    const p = await page('admin', 1440, 900);
    await p.goto(BASE + '/parley', { waitUntil: 'networkidle2' });
    await ready(p);
    await p.click('.pl-item .pl-item-link');
    await p.waitForSelector('.pl-composer textarea');
    await p.click('.pl-emoji-btn');
    await p.waitForSelector('.pl-emoji');
    await shot(p, 'emoji');
    await p.click('.pl-emoji-grid button');
    await p.click('.pl-plus-wrap .pl-ib');
    await shot(p, 'plus');
  }
} catch (e) {
  errors.push('SCRIPT: ' + e.message);
} finally {
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
}
