// Room activity: "Chatting · SEC", "In voice · SEC", and a staff room never
// named to a member who cannot see it. Two browsers against a LOCAL forum with
// Parley Calls; reads watch-tokens.txt (roomwatchA admin, roomwatchB member,
// staffroom <id> of a room on a restricted tag).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/ernestdefoe/github/convoro2/');
const puppeteer = require('puppeteer-core');
const lines = fs.readFileSync('watch-tokens.txt', 'utf8').trim().split('\n').map((l) => l.split(' '));
const tok = Object.fromEntries(lines.filter((l) => l[0].startsWith('roomwatch')));
const staffRoom = +lines.find((l) => l[0] === 'staffroom')[1];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
async function open(u) {
  const ctx = await browser.createBrowserContext();
  await ctx.setCookie({ name: 'flarum_remember', value: tok[u], domain: 'localhost', path: '/' });
  const p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 900 });
  p.on('pageerror', (e) => console.log('PAGEERROR', u, e.message));
  await p.goto('http://localhost:8091/all', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => window.app && app.parley && app.parley.loaded, { timeout: 20000 });
  return p;
}
const lineOnB = (B) => B.evaluate(() => { const row = [...document.querySelectorAll('.pl-person')].find((r) => r.querySelector('.pl-nm')?.textContent.startsWith('roomwatchA')); return row ? row.querySelector('.pl-act').textContent : null; });
const own = (A) => A.evaluate(() => { m.redraw.sync(); return document.querySelector('.pl-me .pl-me-act')?.textContent || null; });
const waitLine = async (B, test, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = await lineOnB(B); if (l && test(l)) return `${l}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`; await new Promise((r) => setTimeout(r, 250)); } return `${await lineOnB(B)}  (NOT within ${ms / 1000}s)`; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const B = await open('roomwatchB');
const A = await open('roomwatchA');
const sec = await A.evaluate(() => app.parley.rooms.find((r) => r.name === 'SEC').id);
await pause(11000);
await A.evaluate((id) => app.parley.openRoom(id), sec);
await pause(1500);
console.log('A own row, room open:', await own(A));
console.log('B sees A chatting:', await waitLine(B, (l) => l.startsWith('Chatting')));
await pause(11000);
await A.evaluate((id) => app.parleyVoice.join(app.parley.room(id)), sec);
await pause(1500);
console.log('A own row, in voice:', await own(A));
console.log('B sees A in voice:', await waitLine(B, (l) => l.startsWith('In voice')));
await A.evaluate(() => app.parleyVoice.leave());
await pause(11000);
await A.evaluate((id) => { app.parley.close(app.parley.open[0]); return app.parley.openRoom(id); }, staffRoom);
await pause(1500);
console.log('A own row, staff room:', await own(A));
const hidden = await waitLine(B, (l) => !l.startsWith('Chatting · SEC') && !l.startsWith('In voice'), 30000);
console.log('B sees A (staff room must stay unnamed):', hidden, (await lineOnB(B))?.includes('QA Staff') ? 'LEAK!' : 'not named');
await browser.close();
