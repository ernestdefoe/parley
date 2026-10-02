/*
 * Pure helpers. No `app`, no Mithril — so the unit tests can import them
 * without a forum around them.
 */

/** A stable hue per name, the same one the mockup gives each initials circle. */
export function hue(name) {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initials(name) {
  const words = String(name || '?')
    .replace(/[^\p{L}\p{N} _]/gu, '')
    .split(/[ _]/)
    .filter(Boolean)
    .slice(0, 2);
  return (words.map((w) => w[0]).join('') || String(name || '?')[0] || '?').toUpperCase();
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Split text into plain strings and {url} parts, in order. */
export function linkParts(text) {
  const out = [];
  let last = 0;
  String(text).replace(URL_RE, (url, at) => {
    if (at > last) out.push(text.slice(last, at));
    out.push({ url });
    last = at + url.length;
    return url;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Where a message sits in a run from the same sender, which decides which
 * corners of its bubble are tucked: first | mid | last | single.
 */
export function runPosition(messages, i) {
  const m = messages[i];
  const same = (o) => o && o.type !== 'call' && m.type !== 'call' && o.userId === m.userId && !breaks(o, m);
  const prev = same(messages[i - 1]) && messages[i - 1];
  const next = same(messages[i + 1]) && messages[i + 1];
  if (prev && next) return 'mid';
  if (prev) return 'last';
  if (next) return 'first';
  return 'single';
}

/** A gap long enough to start a new run, and to draw a time divider. */
export const GAP_MINUTES = 30;

export function breaks(a, b) {
  return Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) > GAP_MINUTES * 60000;
}

/** Whether message i needs a time divider above it. */
export function needsDivider(messages, i) {
  if (i === 0) return true;
  const a = new Date(messages[i - 1].createdAt);
  const b = new Date(messages[i].createdAt);
  return a.toDateString() !== b.toDateString() || breaks(messages[i - 1], messages[i]);
}

/** The mockup's 12:41 — the time in 24-hour form, as a clock reads it. */
export function clock(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** Count reactions per emoji, keeping the order they first appeared. */
export function tally(reactions) {
  const out = new Map();
  for (const r of reactions || []) out.set(r.emoji, (out.get(r.emoji) || 0) + 1);
  return [...out.entries()];
}

/**
 * Where the visitor is, read from the URL. The path is the one thing that is
 * always right: Flarum rewrites it as you scroll a discussion, so `near`
 * follows the reader without any hook into the post stream.
 */
export function placeFromPath(path) {
  let m;
  if ((m = path.match(/^\/d\/(\d+)(?:-[^/]*)?(?:\/(\d+))?/))) {
    return { place: 'discussion', discussionId: Number(m[1]), near: m[2] ? Number(m[2]) : null };
  }
  if ((m = path.match(/^\/t\/([^/?#]+)/))) return { place: 'tag', tagSlug: decodeURIComponent(m[1]) };
  if (/^\/messages(\/|$)/.test(path)) return { place: 'messages' };
  if (/^\/u\//.test(path)) return { place: 'user' };
  if (path === '/' || path === '' || /^\/all\b/.test(path)) return { place: 'index' };
  return { place: 'other' };
}

/** How many docked windows fit beside the rail before the rest become heads. */
export function windowsThatFit(viewportWidth, railWidth) {
  const free = viewportWidth - railWidth - 32;
  return Math.max(1, Math.min(3, Math.floor((free + 12) / 340)));
}
