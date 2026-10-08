import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Rail from './Rail';
import Heads from './Heads';
import ChatWindow from './ChatWindow';
import InboxPage from './InboxPage';
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
    this.sync();

    // Re-measured when the page scrolls or resizes, which is when a theme's
    // back-to-top button comes and goes.
    let pending = null;
    this.measure = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        this.clearCorner(vnode.dom);
        // A theme fades its button in and out. Look again once the fade is
        // over, so a half-faded button neither keeps nor misses the lift.
        clearTimeout(this.settle);
        this.settle = setTimeout(() => this.clearCorner(vnode.dom), 600);
      }, 250);
    };
    window.addEventListener('scroll', this.measure, { passive: true });
    window.addEventListener('resize', this.measure);
    this.measure();
  }

  onremove(vnode) {
    super.onremove(vnode);
    window.removeEventListener('scroll', this.measure);
    window.removeEventListener('resize', this.measure);
  }

  /**
   * Keep clear of whatever else a theme fixes to the bottom-right corner —
   * Bespoke's back-to-top button, most often. The pill and the heads sit in
   * that corner too, and drawn over each other neither can be clicked.
   *
   * Found by looking at what is under the corner, not by naming one theme's
   * button, so any theme's works. Full-width bars (the composer, a cookie
   * banner) are not something to step over and are ignored.
   */
  clearCorner(root) {
    const probes = [
      [window.innerWidth - 34, window.innerHeight - 34],
      [window.innerWidth - 60, window.innerHeight - 30],
    ];
    let lift = 0;

    for (const [x, y] of probes) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (root.contains(el) || el === document.body || el === document.documentElement) continue;
        const style = getComputedStyle(el);
        // A hidden button is usually faded out, and opacity is animated, so
        // mid-fade it reads as half there. `pointer-events: none` is how
        // themes switch it off, and that changes at once.
        if (style.position !== 'fixed' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.width > window.innerWidth / 2) continue;
        lift = Math.max(lift, window.innerHeight - r.top - 14 + 10);
      }
    }

    root.style.setProperty('--pl-lift', Math.max(0, Math.round(lift)) + 'px');
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    this.sync();
  }

  /** The page makes room for the docked rail; the class lives on <body>. */
  sync() {
    const docked = app.parley.railDocked();
    document.body.classList.toggle('Parley--docked', docked);
  }

  view() {
    const s = app.parley;
    const docked = s.railDocked();
    const showRail = docked || s.railSheet;
    // The inbox page draws conversations itself; the dock would repeat them.
    const onInbox = !!(app.current && app.current.matches && app.current.matches(InboxPage));
    const total = s.totalUnread();

    return (
      <div
        className={
          'Parley' + (docked ? ' docked' : '') + (s.railSheet ? ' sheet' : '') + (s.open.some((id) => !s.minimised.has(id)) ? ' has-window' : '')
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
        {!showRail ? (
          <button className="pl-peek" onclick={() => s.toggleRail()} aria-label={extractText(t('rail.show'))}>
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
