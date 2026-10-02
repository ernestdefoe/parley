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
      <div className={'Parley' + (docked ? ' docked' : '') + (s.railSheet ? ' sheet' : '') + (s.open.some((id) => !s.minimised.has(id)) ? ' has-window' : '')}>
        {showRail ? <Rail /> : null}
        {!onInbox ? <Heads /> : null}
        {!onInbox ? (
          <div className="pl-dock">
            {s.open.map((id) => <ChatWindow key={id} id={id} />)}
          </div>
        ) : null}
        {!showRail ? (
          <button className="pl-peek" onclick={() => s.toggleRail()} aria-label={extractText(t('rail.show'))}>
            <span className="pl-peek-dot" />
            <span>{t('rail.peek', { count: s.online.length })}{total ? [' · ', t('rail.peek_unread', { count: total })] : null}</span>
          </button>
        ) : null}
      </div>
    );
  }
}

export { DOCK_BREAKPOINT };
