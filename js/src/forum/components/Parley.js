import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Rail from './Rail';
import Heads from './Heads';
import ChatWindow from './ChatWindow';
import { DOCK_BREAKPOINT } from '../state';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * Everything Parley draws over the forum: the rail, the heads, the dock, and
 * the "N online" pill that brings the rail back when it is hidden or the
 * screen is too narrow to dock it.
 */
export default class Parley extends Component {
  oncreate(vnode) {
    super.oncreate(vnode);
    this.covered = new Set();
    this.sync();

    // Re-measured when the page scrolls or resizes, which is when a theme's
    // back-to-top button comes and goes.
    let pending = null;
    this.measure = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        this.clearHeader(vnode.dom);
        this.clearCorner(vnode.dom);
        // A theme fades its button in and out. Look again once the fade is
        // over, so a half-faded button neither keeps nor misses the lift.
        clearTimeout(this.settle);
        this.settle = setTimeout(() => this.clearCorner(vnode.dom), 600);
      }, 250);
    };
    window.addEventListener('scroll', this.measure, { passive: true });
    window.addEventListener('resize', this.measure);

    // The floating list closes on a click anywhere else, or Escape.
    this.away = (e) => {
      const s = app.parley;
      if (!s.railSheet || s.railDocked()) return;
      const t = e.target;
      if (t.closest && (t.closest('.pl-rail') || t.closest('.pl-peek') || t.closest('.Modal') || t.closest('.Dropdown-menu'))) return;
      s.railSheet = false;
      m.redraw();
    };
    this.escape = (e) => {
      if (e.key === 'Escape' && app.parley.railSheet && !app.parley.railDocked()) {
        app.parley.railSheet = false;
        m.redraw();
      }
    };
    document.addEventListener('pointerdown', this.away, true);
    document.addEventListener('keydown', this.escape);
    this.measure();
  }

  onremove(vnode) {
    super.onremove(vnode);
    this.covered.forEach((el) => el.removeAttribute('data-parley-covered'));
    window.removeEventListener('scroll', this.measure);
    window.removeEventListener('resize', this.measure);
    document.removeEventListener('pointerdown', this.away, true);
    document.removeEventListener('keydown', this.escape);
  }

  /**
   * Keep clear of whatever else a page fixes to the bottom of the screen —
   * a theme's back-to-top button (Bespoke's, most often), Mobile Tab's bar,
   * a minimised composer. Found by looking at what is there, never by naming
   * one theme's button, so any forum's works.
   *
   * - Bars across the bottom (Mobile Tab, the composer): everything of
   *   Parley's sits above them — heads, pill and windows (`--parley-bar`).
   * - Small buttons in the column the heads and pill use: those lift above
   *   them (`--pl-lift`).
   * - Small buttons over an open window: the window wins. They are faded
   *   out while it is open and come back as soon as it closes or moves.
   */
  clearCorner(root) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const foreign = (el) => el && !root.contains(el) && el !== document.body && el !== document.documentElement;
    const fixedRect = (el) => {
      const style = getComputedStyle(el);
      // A hidden button is usually faded out, and opacity is animated, so
      // mid-fade it reads as half there. `pointer-events: none` is how
      // themes switch it off, and that changes at once.
      if (style.position !== 'fixed' || style.visibility === 'hidden' || style.pointerEvents === 'none') return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height ? r : null;
    };
    const isBar = (r) => r.width >= vw * 0.9 && r.bottom >= vh - 2 && r.height <= 100;

    // Bars along the bottom edge, sampled across it.
    let bar = 0;
    for (const x of [vw * 0.1, vw * 0.5, vw * 0.9]) {
      for (const el of document.elementsFromPoint(x, vh - 4)) {
        if (!foreign(el)) continue;
        const r = fixedRect(el);
        if (r && isBar(r)) bar = Math.max(bar, vh - r.top);
      }
    }

    // Small buttons in the heads' and pill's column, above the bars.
    const column = root.querySelector('.pl-heads, .pl-peek');
    const cr = column && column.getBoundingClientRect();
    const cx = cr && cr.width ? cr.left + cr.width / 2 : vw - 34;
    let lift = 0;
    for (const [x, y] of [
      [cx, vh - bar - 34],
      [cx - 26, vh - bar - 30],
    ]) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (!foreign(el) || this.covered.has(el)) continue;
        const r = fixedRect(el);
        if (!r || r.width > vw / 2) continue;
        lift = Math.max(lift, vh - bar - r.top + 10 - 14);
      }
    }

    // Small buttons over an open window: hidden while it is open.
    const wins = [...root.querySelectorAll('.pl-dock .pl-win:not(.min)')].map((w) => w.getBoundingClientRect()).filter((r) => r.width);
    const overlaps = (r) => wins.some((w) => r.left < w.right && r.right > w.left && r.top < w.bottom && r.bottom > w.top);
    const now = new Set();
    for (const w of wins) {
      for (const [x, y] of [
        [w.right - 30, w.bottom - 30],
        [w.right - 30, w.bottom - 80],
        [w.left + w.width / 2, w.bottom - 30],
        [w.left + 30, w.bottom - 30],
      ]) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (!foreign(el) || root.contains(el)) continue;
          const r = fixedRect(el);
          if (r && r.width <= vw / 2 && r.height <= 120) now.add(el);
        }
      }
    }
    // Ones already hidden no longer answer a hit test; keep them while they
    // still sit over a window.
    this.covered.forEach((el) => document.contains(el) && overlaps(el.getBoundingClientRect()) && now.add(el));
    this.covered.forEach((el) => !now.has(el) && el.removeAttribute('data-parley-covered'));
    now.forEach((el) => el.setAttribute('data-parley-covered', ''));
    this.covered = now;

    const html = document.documentElement.style;
    html.setProperty('--parley-bar', Math.round(bar) + 'px');
    root.style.setProperty('--pl-lift', Math.max(0, Math.round(lift + bar)) + 'px');
  }

  /**
   * Start the docked list where the theme's header ends. Themes draw headers
   * of every height (Masthead's is two bars tall), and one that scrolls away
   * leaves the top of the screen free again.
   */
  clearHeader(root) {
    const header = document.getElementById('header');
    const bottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : null;
    if (bottom !== null) root.style.setProperty('--pl-top', bottom + 'px');
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    this.sync();
    // A window opened, closed or moved: look again at what it covers.
    this.measure();
  }

  /** The page makes room for the docked rail; the class lives on <body>. */
  sync() {
    const docked = app.parley.railDocked();
    document.body.classList.toggle('Parley--docked', docked);
  }

  view() {
    const s = app.parley;
    // The inbox page draws conversations itself; the dock would repeat them.
    const onInbox = s.onInbox();
    const docked = s.railDocked();
    const showRail = docked || (s.railSheet && !onInbox);
    // The open list is a panel popping up from the online button, on a
    // phone too, where it spans the width above Mobile Tab's bar.
    const floating = !docked && s.railSheet && !onInbox;
    const total = s.totalUnread();

    return (
      <div
        className={
          'Parley' +
          (docked ? ' docked' : '') +
          (s.railSheet ? ' sheet' : '') +
          (floating ? ' floating' : '') +
          (s.open.some((id) => !s.minimised.has(id)) ? ' has-window' : '')
        }
      >
        {showRail ? <Rail /> : null}
        {!onInbox ? <Heads /> : null}
        {!onInbox ? (
          <div className="pl-dock">
            {s.open.map((id) => (
              <ChatWindow key={id} id={id} />
            ))}
          </div>
        ) : null}
        {/* Not on the messages page: there the messenger is the screen, and
            the button would sit on its composer. */}
        {!docked && !onInbox ? (
          <button
            className={'pl-peek' + (s.railSheet ? ' active' : '')}
            onclick={() => s.toggleRail()}
            aria-label={extractText(s.railSheet ? t('rail.hide') : t('rail.show'))}
            aria-expanded={String(!!s.railSheet)}
          >
            <span className="pl-peek-dot" />
            <span>
              {t('rail.peek', { count: s.onlineCount() })}
              {total ? [' · ', t('rail.peek_unread', { count: total })] : null}
            </span>
          </button>
        ) : null}
      </div>
    );
  }
}

export { DOCK_BREAKPOINT };
