// Activity lines, as a passive viewer sees them: B never refreshes on its own
// initiative, A moves around. Measures how long each change takes to reach B.
//   node tools/activity-e2e.mjs   (reads act-tokens.txt: actqa1/actqa2 tokens; LOCAL forum)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/ernestdefoe/github/convoro2/');
const puppeteer = require('puppeteer-core');
const tok = Object.fromEntries(fs.readFileSync('act-tokens.txt', 'utf8').trim().split('\n').map((l) => l.split(' ')));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
async function open(u, path) {
  const ctx = await browser.createBrowserContext();
  await ctx.setCookie({ name: 'flarum_remember', value: tok[u], domain: 'localhost', path: '/' });
  const p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:8091' + path, { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => window.app && app.parley && app.parley.loaded, { timeout: 20000 });
  return p;
}
// B never forces anything: it only sees what reaches it on its own.
const lineOnB = (B) => B.evaluate(() => { const row = [...document.querySelectorAll('.pl-person')].find((r) => r.querySelector('.pl-nm')?.textContent.startsWith('actqa1')); return row ? row.querySelector('.pl-act').textContent : null; });
const waitLine = async (B, test, ms = 35000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const l = await lineOnB(B); if (l && test(l)) return { line: l, s: ((Date.now() - t0) / 1000).toFixed(1) }; await new Promise((r) => setTimeout(r, 250)); }
  return { line: await lineOnB(B), s: 'NOT within ' + ms / 1000 + 's' };
};
const B = await open('actqa2', '/all');
const A = await open('actqa1', '/all');
await new Promise((r) => setTimeout(r, 4000));
console.log('A on the index:', JSON.stringify(await waitLine(B, (l) => l.includes('Browsing'))));
const disc = await A.evaluate(async () => (await app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/discussions?page[limit]=1' })).data[0]);
await new Promise((r) => setTimeout(r, 11000)); // clear the 10s move window from A's arrival
await A.evaluate((id) => m.route.set(app.route('discussion', { id })), disc.id);
console.log('A clicks into a discussion:', JSON.stringify(await waitLine(B, (l) => l.startsWith('Reading'))));
await new Promise((r) => setTimeout(r, 11000));
await A.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Reply$/i.test(b.textContent.trim()))?.click());
console.log('A opens a reply:', JSON.stringify(await waitLine(B, (l) => l.startsWith('Writing a reply'))));
await new Promise((r) => setTimeout(r, 11000));
await A.evaluate(() => app.composer.close());
console.log('A closes the reply:', JSON.stringify(await waitLine(B, (l) => l.startsWith('Reading'))));
await browser.close();
