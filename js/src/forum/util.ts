/*
 * Pure helpers. No `app`, no Mithril — so the unit tests can import them
 * without a forum around them.
 */

import type { Message, Place, Reaction } from './types';

/** A piece of text: plain words, or a link. */
export type LinkPart = string | { url: string };
/** A piece of text: plain words, or an @mention. */
export type MentionPart = string | { username: string };
/** The fields a run and a divider look at, so pending bubbles count too. */
type RunMessage = Pick<Message, 'type' | 'userId' | 'pending' | 'createdAt'>;

/** A stable hue per name, the same one the mockup gives each initials circle. */
export function hue(name: unknown): number {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initials(name: unknown): string {
  const words = String(name || '?')
    .replace(/[^\p{L}\p{N} _]/gu, '')
    .split(/[ _]/)
    .filter(Boolean)
    .slice(0, 2);
  return (words.map((w) => w[0]).join('') || String(name || '?')[0] || '?').toUpperCase();
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Split text into plain strings and {url} parts, in order. */
export function linkParts(text: string): LinkPart[] {
  const out: LinkPart[] = [];
  let last = 0;
  String(text).replace(URL_RE, (url: string, at: number) => {
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
export function runPosition(messages: RunMessage[], i: number): 'first' | 'mid' | 'last' | 'single' {
  const m = messages[i];
  const own = (x: RunMessage) => x.type !== 'call' && x.type !== 'system';
  const same = (o: RunMessage | undefined) => o && own(o) && own(m) && o.userId === m.userId && !!o.pending === !!m.pending && !breaks(o, m);
  const prev = same(messages[i - 1]) && messages[i - 1];
  const next = same(messages[i + 1]) && messages[i + 1];
  if (prev && next) return 'mid';
  if (prev) return 'last';
  if (next) return 'first';
  return 'single';
}

/** A gap long enough to start a new run, and to draw a time divider. */
export const GAP_MINUTES = 30;

export function breaks(a: Pick<Message, 'createdAt'>, b: Pick<Message, 'createdAt'>): boolean {
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) > GAP_MINUTES * 60000;
}

/** Whether message i needs a time divider above it. */
export function needsDivider(messages: Pick<Message, 'createdAt'>[], i: number): boolean {
  if (i === 0) return true;
  const a = new Date(messages[i - 1].createdAt);
  const b = new Date(messages[i].createdAt);
  return a.toDateString() !== b.toDateString() || breaks(messages[i - 1], messages[i]);
}

/** The mockup's 12:41 — the time in 24-hour form, as a clock reads it. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** Count reactions per emoji, keeping the order they first appeared. */
export function tally(reactions: Reaction[] | null | undefined): [string, number][] {
  const out = new Map<string, number>();
  for (const r of reactions || []) out.set(r.emoji, (out.get(r.emoji) || 0) + 1);
  return [...out.entries()];
}

/**
 * Where the visitor is, read from the URL. The path is the one thing that is
 * always right: Flarum rewrites it as you scroll a discussion, so `near`
 * follows the reader without any hook into the post stream.
 */
export function placeFromPath(path: string): Place {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/d\/(\d+)(?:-[^/]*)?(?:\/(\d+))?/))) {
    return { place: 'discussion', discussionId: Number(m[1]), near: m[2] ? Number(m[2]) : null };
  }
  if ((m = path.match(/^\/t\/([^/?#]+)/))) return { place: 'tag', tagSlug: decodeURIComponent(m[1]) };
  if (/^\/parley(\/|$)/.test(path)) return { place: 'messages' };
  if (/^\/u\//.test(path)) return { place: 'user' };
  if (path === '/' || path === '' || /^\/all\b/.test(path)) return { place: 'index' };
  return { place: 'other' };
}

/** How many docked windows fit beside the rail before the rest become heads. */
export function windowsThatFit(viewportWidth: number, railWidth: number): number {
  const free = viewportWidth - railWidth - 32;
  return Math.max(1, Math.min(3, Math.floor((free + 12) / 340)));
}

const MENTION_RE = /(^|[^\w@])@([A-Za-z0-9_\-.]{2,30})/g;

/** Split plain text into strings and {username} parts for @mentions. */
export function mentionParts(text: string): MentionPart[] {
  const out: MentionPart[] = [];
  let last = 0;
  String(text).replace(MENTION_RE, (match: string, lead: string, username: string, at: number) => {
    const start = at + lead.length;
    if (start > last) out.push(text.slice(last, start));
    out.push({ username });
    last = start + 1 + username.length;
    return match;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * White or near-black, whichever reads better on this background, by WCAG
 * relative luminance. A tag colour can be anything from navy to gold.
 */
export function readableOn(hex: unknown): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#ffffff';
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // #171b24 is Parley's own ink colour.
  const ink = 0.0107;
  return contrast(L, 1) >= contrast(L, ink) ? '#ffffff' : '#171b24';
}
