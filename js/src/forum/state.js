import app from 'flarum/forum/app';
import api from './api';
import { placeFromPath, windowsThatFit } from './util';

const HEARTBEAT = 30000;
const HEARTBEAT_NO_REALTIME = 15000;
const POLL_OPEN = 5000;
const TYPING_TTL = 6000;
const TYPING_SEND_EVERY = 3000;
const MAX_HEADS = 6;
export const RAIL_WIDTH = 300;
export const DOCK_BREAKPOINT = 1200;
export const MOBILE_BREAKPOINT = 820;

/**
 * Everything Parley knows, for every component that draws it.
 *
 * One instance per page load, reached as `app.parley`. Kept off the module's
 * default export as an INSTANCE on purpose: Flarum's auto-export loader cannot
 * register `export default new X()`, so Parley Calls reaches this through
 * `app.parley`, not an import.
 */
export default class ParleyState {
  constructor() {
    this.config = app.forum.attribute('parley') || {};
    const user = app.session.user;
    this.me = user;
    this.chosenStatus = (user && user.preferences()?.parleyStatus) || 'online';
    this.idle = false;

    this.online = [];
    this.followingOffline = [];
    this.more = 0;
    this.guests = 0;
    this.loaded = false;

    /** id → { summary, messages, hasOlder, loadingOlder, typing: {userId: until} } */
    this.convs = new Map();
    this.unread = {};
    this.open = [];
    this.heads = [];
    this.minimised = new Set();
    this.flash = new Set();
    this.replyTo = {};
    this.editing = {};
    this.reporting = null;
    /** The conversation the inbox page is showing, if it is open. */
    this.pageConversation = null;

    this.filter = '';
    this.found = [];
    this.sections = { follow: true, all: true };
    this.statusMenu = false;
    this.railHidden = false;
    this.railSheet = false;

    this.realtime = false;
    this.lastTypingSent = {};
    this.listeners = new Set();

    /** Set by Parley Calls when it is installed, so copy that mentions calls can say so. */
    this.callsInstalled = false;

    this.restore();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    this.bindRealtime();
    this.watchIdle();
    this.beat();
    this.timer = setInterval(() => this.beat(), this.realtime ? HEARTBEAT : HEARTBEAT_NO_REALTIME);
    this.poller = setInterval(() => this.pollOpen(), POLL_OPEN);
    this.typingSweep = setInterval(() => this.sweepTyping(), 1000);

    // Reopen whatever was open before the page was reloaded.
    [...this.open, ...this.heads].forEach((id) => this.load(id));

    window.addEventListener('resize', () => this.fit());
  }

  get status() {
    if (this.chosenStatus === 'online' && this.idle) return 'away';
    return this.chosenStatus;
  }

  setStatus(status) {
    this.chosenStatus = status;
    this.statusMenu = false;
    this.beat();
    m.redraw();
  }

  /** Where the visitor is right now, in the heartbeat's terms. */
  where() {
    const base = (app.forum.attribute('basePath') || '').replace(/\/$/, '');
    let path = window.location.pathname;
    if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
    const where = placeFromPath(path);

    if (where.tagSlug) {
      const tag = app.store.all('tags').find((t) => t.slug() === where.tagSlug);
      where.tagId = tag ? Number(tag.id()) : null;
      delete where.tagSlug;
    }

    // Writing a reply is its own activity: "Writing a reply · <thread>".
    const composing = app.composer && app.composer.isVisible && app.composer.isVisible() && app.composer.body?.attrs?.discussion;
    if (composing) {
      where.place = 'reply';
      where.discussionId = Number(app.composer.body.attrs.discussion.id());
    }

    return where;
  }

  beat() {
    return api
      .heartbeat({ status: this.status, ...this.where() })
      .then((r) => {
        if (!r || !r.online) return;
        this.online = r.online;
        this.followingOffline = r.followingOffline || [];
        this.more = r.more || 0;
        this.guests = r.guests || 0;
        this.loaded = true;
        this.applyUnread(r.unread || {});
        m.redraw();
      });
  }

  /** A route change is a new place; tell the list now rather than in 30s. */
  moved() {
    clearTimeout(this.movedTimer);
    this.movedTimer = setTimeout(() => this.beat(), 1500);
  }

  // ── Idle → Away ───────────────────────────────────────────────────────────

  watchIdle() {
    const minutes = this.config.awayMinutes || 10;
    let last = Date.now();
    const active = () => {
      last = Date.now();
      if (this.idle) {
        this.idle = false;
        this.beat();
        m.redraw();
      }
    };
    ['mousemove', 'keydown', 'pointerdown', 'scroll', 'focus'].forEach((e) => window.addEventListener(e, active, { passive: true }));
    setInterval(() => {
      if (!this.idle && Date.now() - last > minutes * 60000) {
        this.idle = true;
        this.beat();
        m.redraw();
      }
    }, 30000);
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  bindRealtime() {
    if (!this.config.realtime || !('flarum-realtime' in (flarum.extensions || {}))) return;

    let rt;
    try {
      rt = flarum.reg.get('flarum-realtime', 'forum/RealtimeState');
    } catch (e) {
      return;
    }
    if (!rt || typeof rt.onUserChannelReady !== 'function') return;

    this.realtime = true;

    // Re-runs on every reconnect with the new channel object, so bindings are
    // never left on a dead socket.
    rt.onUserChannelReady((channel) => {
      channel.bind('parley.message', (d) => this.received(d.message));
      channel.bind('parley.messageChanged', (d) => this.changed(d.message));
      channel.bind('parley.read', (d) => this.readBy(d));
      channel.bind('parley.typing', (d) => this.typingFrom(d));
      this.listeners.forEach((fn) => fn(channel));
    });
  }

  /** For Parley Calls: bind more events on the same channel. */
  onChannel(fn) {
    this.listeners.add(fn);
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  conv(id) {
    return this.convs.get(Number(id));
  }

  ensure(summary, messages) {
    const id = summary.id;
    const existing = this.convs.get(id);
    if (existing) {
      existing.summary = summary;
      if (messages) existing.messages = messages;
      return existing;
    }
    const c = { summary, messages: messages || [], hasOlder: (messages || []).length >= 40, loadingOlder: false, typing: {} };
    this.convs.set(id, c);
    return c;
  }

  load(id) {
    return api
      .show(id)
      .then((r) => {
        this.ensure(r.conversation, r.messages);
        this.unread[id] = r.conversation.unread;
        this.markRead(id);
        m.redraw();
      })
      .catch(() => this.close(id));
  }

  /** Open the conversation with a person: click their row, their card, anything. */
  openWith(userId) {
    const existing = [...this.convs.values()].find(
      (c) => !c.summary.isGroup && c.summary.participants.some((p) => p.id === Number(userId))
    );
    if (existing) return Promise.resolve(this.show(existing.summary.id));

    return api.open(userId).then((r) => {
      this.ensure(r.conversation, r.messages);
      this.show(r.conversation.id);
    });
  }

  show(id) {
    id = Number(id);
    this.heads = this.heads.filter((h) => h !== id);
    this.minimised.delete(id);
    if (!this.open.includes(id)) {
      this.open.push(id);
    }
    this.fit();
    this.railSheet = false;
    this.markRead(id);
    this.save();
    m.redraw();
    if (!this.conv(id)) this.load(id);
    setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
  }

  /** Keep only as many windows as fit; the oldest fall back to heads. */
  fit() {
    const width = window.innerWidth;
    if (width < MOBILE_BREAKPOINT) {
      while (this.open.length > 1) this.heads.unshift(this.open.shift());
      return;
    }
    const rail = this.railDocked() ? RAIL_WIDTH : 0;
    const max = windowsThatFit(width, rail);
    while (this.open.length > max) this.heads.unshift(this.open.shift());
    this.heads = this.heads.slice(0, MAX_HEADS);
  }

  toHead(id) {
    id = Number(id);
    this.open = this.open.filter((o) => o !== id);
    if (!this.heads.includes(id)) this.heads.unshift(id);
    this.heads = this.heads.slice(0, MAX_HEADS);
    this.save();
  }

  toggleMinimised(id) {
    id = Number(id);
    this.minimised.has(id) ? this.minimised.delete(id) : this.minimised.add(id);
    if (!this.minimised.has(id)) this.markRead(id);
    this.save();
  }

  close(id) {
    id = Number(id);
    this.open = this.open.filter((o) => o !== id);
    this.heads = this.heads.filter((h) => h !== id);
    this.minimised.delete(id);
    delete this.replyTo[id];
    delete this.editing[id];
    this.save();
    m.redraw();
  }

  isVisible(id) {
    id = Number(id);
    if (document.visibilityState !== 'visible') return false;
    // Open in the inbox page counts as being read, the same as a docked window.
    if (this.pageConversation === id) return true;
    return this.open.includes(id) && !this.minimised.has(id);
  }

  older(id) {
    const c = this.conv(id);
    if (!c || c.loadingOlder || !c.hasOlder || !c.messages.length) return;
    c.loadingOlder = true;
    return api.show(id, { before: c.messages[0].id }).then((r) => {
      c.messages = [...r.messages, ...c.messages];
      c.hasOlder = r.messages.length >= 40;
      c.loadingOlder = false;
      m.redraw();
    });
  }

  // ── Messages in ───────────────────────────────────────────────────────────

  received(message) {
    const id = message.conversationId;
    const c = this.conv(id);

    if (!c) {
      // A conversation this tab has not seen yet: fetch it, then show it.
      api.show(id).then((r) => {
        this.ensure(r.conversation, r.messages);
        this.arrived(id, message);
      });
      return;
    }

    if (!c.messages.some((x) => x.id === message.id)) {
      c.messages.push(message);
      c.messages.sort((a, b) => a.id - b.id);
    }
    c.summary.lastMessage = message;
    c.summary.lastMessageAt = message.createdAt;
    if (message.userId) delete c.typing[message.userId];
    this.arrived(id, message);
  }

  arrived(id, message) {
    const mine = message.userId === Number(this.me.id());

    if (!mine) {
      if (this.isVisible(id)) {
        this.markRead(id);
      } else {
        this.unread[id] = (this.unread[id] || 0) + 1;
        // Messenger brings the conversation forward as a head. Busy keeps it
        // quiet: the badge still counts, nothing pops.
        if (!this.open.includes(id) && !this.heads.includes(id) && this.status !== 'busy') {
          this.heads.unshift(id);
          this.heads = this.heads.slice(0, MAX_HEADS);
          this.save();
        }
        this.flash.add(id);
        setTimeout(() => {
          this.flash.delete(id);
          m.redraw();
        }, 1600);
      }
    }
    m.redraw();
  }

  changed(message) {
    const c = this.conv(message.conversationId);
    if (!c) return;
    const i = c.messages.findIndex((x) => x.id === message.id);
    if (i >= 0) c.messages[i] = message;
    m.redraw();
  }

  readBy({ conversationId, userId, messageId }) {
    const c = this.conv(conversationId);
    if (!c) return;
    if (userId === Number(this.me.id())) {
      // Read in another tab.
      this.unread[conversationId] = 0;
    } else {
      c.summary.seenBy = { ...(c.summary.seenBy || {}), [userId]: messageId };
    }
    m.redraw();
  }

  typingFrom({ conversationId, userId }) {
    const c = this.conv(conversationId);
    if (!c) return;
    c.typing[userId] = Date.now() + TYPING_TTL;
    m.redraw();
  }

  sweepTyping() {
    let changed = false;
    const now = Date.now();
    this.convs.forEach((c) => {
      for (const uid in c.typing) {
        if (c.typing[uid] < now) {
          delete c.typing[uid];
          changed = true;
        }
      }
    });
    if (changed) m.redraw();
  }

  applyUnread(map) {
    for (const key in map) {
      const id = Number(key);
      const n = map[key];
      if (n > 0 && !this.isVisible(id) && !this.open.includes(id) && !this.heads.includes(id) && this.status !== 'busy') {
        this.heads.push(id);
        if (!this.conv(id)) this.load(id);
      }
    }
    this.unread = { ...map };
    // Anything open and in view is being read, whatever the server counted.
    this.open.forEach((id) => this.isVisible(id) && (this.unread[id] = 0));
    this.heads = this.heads.slice(0, MAX_HEADS);
  }

  /**
   * Without realtime: refresh the open conversations.
   *
   * The latest page, not just what is newer than the last id. "Newer than"
   * finds new messages but never sees a reaction, an edit or a read receipt
   * on one already drawn, so without realtime those would never arrive.
   */
  pollOpen() {
    if (this.realtime || document.visibilityState !== 'visible') return;
    this.open.forEach((id) => {
      const c = this.conv(id);
      if (!c || this.minimised.has(id)) return;
      api.show(id, { latest: 1 }).then((r) => {
        if (!r) return;
        c.summary = { ...r.conversation, lastReadMessageId: Math.max(r.conversation.lastReadMessageId || 0, c.summary.lastReadMessageId || 0) };
        r.messages.forEach((msg) => {
          const i = c.messages.findIndex((x) => x.id === msg.id);
          if (i >= 0) c.messages[i] = msg;
          else this.received(msg);
        });
        m.redraw();
      });
    });
  }

  totalUnread() {
    return Object.values(this.unread).reduce((a, n) => a + (n || 0), 0);
  }

  // ── Messages out ──────────────────────────────────────────────────────────

  send(id, body) {
    const replyTo = this.replyTo[id];
    delete this.replyTo[id];
    return api.send(id, body, replyTo ? replyTo.id : null).then((r) => this.received(r.message));
  }

  upload(id, file) {
    return api.upload(id, file).then((r) => this.received(r.message));
  }

  edit(messageId, body) {
    return api.edit(messageId, body).then((r) => this.changed(r.message));
  }

  remove(messageId) {
    return api.remove(messageId).then((r) => this.changed(r.message));
  }

  react(messageId, emoji) {
    return api.react(messageId, emoji).then((r) => this.changed(r.message));
  }

  typing(id) {
    const now = Date.now();
    if (now - (this.lastTypingSent[id] || 0) < TYPING_SEND_EVERY) return;
    this.lastTypingSent[id] = now;
    if (this.realtime) api.action(id, 'typing');
  }

  markRead(id) {
    const c = this.conv(id);
    if (!c || !c.messages.length || !this.isVisible(id)) return;
    const last = c.messages[c.messages.length - 1].id;
    this.unread[id] = 0;
    if ((c.summary.lastReadMessageId || 0) >= last) return;
    c.summary.lastReadMessageId = last;
    api.action(id, 'read', { messageId: last });
  }

  hide(id) {
    api.action(id, 'hide');
    this.close(id);
  }

  // ── People ────────────────────────────────────────────────────────────────

  search(q) {
    this.filter = q;
    clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.found = [];
      return;
    }
    this.searchTimer = setTimeout(() => {
      api.people(q.trim()).then((r) => {
        if (this.filter === q) {
          this.found = r.people || [];
          m.redraw();
        }
      });
    }, 250);
  }

  follow(userId, on) {
    return api.person(userId, 'follow', on).then(() => this.beat());
  }

  block(userId, on) {
    return api.person(userId, 'block', on).then(() => {
      this.beat();
      [...this.convs.values()]
        .filter((c) => !c.summary.isGroup && c.summary.participants.some((p) => p.id === Number(userId)))
        .forEach((c) => this.close(c.summary.id));
    });
  }

  person(userId) {
    userId = Number(userId);
    return (
      this.online.find((p) => p.id === userId) ||
      this.followingOffline.find((p) => p.id === userId) ||
      [...this.convs.values()].flatMap((c) => c.summary.participants).find((p) => p.id === userId)
    );
  }

  /** Live presence for someone in a conversation, from the latest heartbeat. */
  presenceOf(userId) {
    const p = this.online.find((x) => x.id === Number(userId));
    if (p) return p;
    const f = this.followingOffline.find((x) => x.id === Number(userId));
    return f || { status: 'offline', activity: null };
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  railDocked() {
    return !this.railHidden && window.innerWidth >= DOCK_BREAKPOINT;
  }

  toggleRail() {
    if (window.innerWidth < DOCK_BREAKPOINT) {
      this.railSheet = !this.railSheet;
    } else {
      this.railHidden = !this.railHidden;
      this.fit();
      this.save();
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  key() {
    return 'parley:ui:' + (this.me ? this.me.id() : 'guest');
  }

  save() {
    try {
      localStorage.setItem(
        this.key(),
        JSON.stringify({ open: this.open, heads: this.heads, min: [...this.minimised], railHidden: this.railHidden })
      );
    } catch (e) {
      // Private windows refuse storage; Parley works without it.
    }
  }

  restore() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key()) || '{}');
      this.open = (s.open || []).map(Number);
      this.heads = (s.heads || []).map(Number);
      this.minimised = new Set((s.min || []).map(Number));
      this.railHidden = !!s.railHidden;
    } catch (e) {
      // Nothing saved, or storage refused.
    }
  }
}
