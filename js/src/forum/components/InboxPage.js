import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import RoomTile from './RoomTile';
import ChatWindow from './ChatWindow';
import api from '../api';
import { clock } from '../util';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.inbox.' + key, params);

/**
 * /messages — every conversation, with the selected one filling the right
 * side. The same window component as the dock, drawn full height. On a phone
 * the list and the conversation take turns.
 */
export default class InboxPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'Parley-inboxPage';
    this.loading = true;
    this.list = [];
    this.tab = 'messages';
    this.reports = null;
    this.selected = Number(m.route.param('id')) || null;

    app.setTitle(extractText(t('title')));
    app.setTitleCount(0);

    if (!app.parley) {
      this.loading = false;
      return;
    }

    app.parley.pageConversation = this.selected;
    if (this.selected) app.parley.touchRoom(this.selected);

    api.conversations().then((r) => {
      this.list = r.conversations;
      r.conversations.forEach((c) => app.parley.ensure(c));
      this.loading = false;
      if (this.selected) app.parley.load(this.selected);
      m.redraw();
    });
  }

  onbeforeupdate(vnode) {
    super.onbeforeupdate(vnode);
    const id = Number(m.route.param('id')) || null;
    if (id !== this.selected) {
      this.selected = id;
      app.parley.pageConversation = id;
      if (id) {
        app.parley.load(id);
        app.parley.touchRoom(id);
      }
    }
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (app.parley) app.parley.pageConversation = null;
  }

  view() {
    if (!app.parley) {
      return (
        <div className="Parley-inbox">
          <p className="pl-guests">{t('no_access')}</p>
        </div>
      );
    }

    const s = app.parley;
    // Newest activity first, including conversations that changed since the
    // list was fetched.
    const convs = [
      ...new Map([
        ...this.list.map((c) => [c.id, c]),
        ...[...s.convs.values()].filter((c) => c.summary.lastMessage).map((c) => [c.summary.id, c.summary]),
      ]).values(),
    ]
      .map((c) => s.conv(c.id)?.summary || c)
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    return (
      <div className={'Parley Parley-inbox' + (this.selected ? ' has-selected' : '')}>
        <div className="pl-inbox-list">
          <div className="pl-inbox-head">
            <h2>{t('title')}</h2>
            {s.config.canModerate ? (
              <div className="pl-tabs" role="tablist">
                <button role="tab" aria-selected={String(this.tab === 'messages')} onclick={() => (this.tab = 'messages')}>
                  {t('messages')}
                </button>
                <button role="tab" aria-selected={String(this.tab === 'reports')} onclick={() => this.openReports()}>
                  {t('reports')}
                </button>
              </div>
            ) : null}
          </div>
          {this.tab === 'reports' ? (
            this.reportsList()
          ) : this.loading ? (
            <LoadingIndicator />
          ) : (
            [
              this.roomsList(),
              s.rooms.length ? <div className="pl-inbox-sec">{t('direct')}</div> : null,
              convs.length ? convs.filter((c) => c.type !== 'room').map((c) => this.item(c)) : <p className="pl-guests">{t('empty')}</p>,
            ]
          )}
        </div>
        <div className="pl-inbox-main">
          {this.selected ? <ChatWindow key={this.selected} id={this.selected} page={true} /> : <p className="pl-inbox-pick">{t('pick')}</p>}
        </div>
      </div>
    );
  }

  /** Rooms first, in the admin's order, with what is unread in each. */
  roomsList() {
    const s = app.parley;
    if (!s.rooms.length) return null;

    return [
      <div className="pl-inbox-sec">{t('rooms')}</div>,
      // Conferences, then the team rooms you have joined, each under its own.
      s.rooms
        .filter((r) => !r.parentId)
        .flatMap((p) => [p, ...s.rooms.filter((c) => c.parentId === p.id)])
        .map((r) => (
          <a
            className={'pl-inbox-item' + (r.parentId ? ' child' : '') + (r.id === this.selected ? ' active' : '') + (r.unread ? ' unread' : '')}
            href={app.route('parley.conversation', { id: r.id })}
            onclick={(e) => {
              e.preventDefault();
              const go = () => m.route.set(app.route('parley.conversation', { id: r.id }));
              r.joined
                ? go()
                : app.parley.openRoom(r.id).then(() => {
                    app.parley.close(r.id);
                    go();
                  });
            }}
          >
            {RoomTile(r, 44)}
            <span className="pl-info">
              <span className="pl-nm">{r.name}</span>
              <span className="pl-act">
                {r.online
                  ? app.translator.trans('ernestdefoe-parley.forum.rooms.online_count', { count: r.online })
                  : r.description || app.translator.trans('ernestdefoe-parley.forum.rooms.members_count', { count: r.members })}
              </span>
            </span>
            <span className="pl-inbox-meta">{r.unread ? <span className="pl-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}</span>
          </a>
        )),
    ];
  }

  item(c) {
    const s = app.parley;
    const peer = c.participants[0] || { displayName: '?' };
    const live = { ...peer, ...s.presenceOf(peer.id) };
    const last = c.lastMessage;
    const mine = last && last.userId === Number(app.session.user.id());
    const unread = s.unread[c.id] || 0;
    const preview = !last
      ? ''
      : last.deleted
        ? extractText(app.translator.trans('ernestdefoe-parley.forum.window.deleted'))
        : last.type === 'image'
          ? extractText(app.translator.trans('ernestdefoe-parley.forum.window.photo'))
          : last.type === 'call'
            ? extractText(app.translator.trans('ernestdefoe-parley.forum.window.call_voice'))
            : last.body;

    return (
      <a
        className={'pl-inbox-item' + (c.id === this.selected ? ' active' : '') + (unread ? ' unread' : '')}
        href={app.route('parley.conversation', { id: c.id })}
        onclick={(e) => {
          e.preventDefault();
          m.route.set(app.route('parley.conversation', { id: c.id }));
        }}
      >
        {Avatar(live, 44, { dot: true })}
        <span className="pl-info">
          <span className="pl-nm">{c.isGroup ? c.title : peer.displayName}</span>
          <span className="pl-act">
            {mine ? [t('you'), ': '] : null}
            {preview}
          </span>
        </span>
        <span className="pl-inbox-meta">
          <span className="pl-mono">
            {last ? (new Date(last.createdAt).toDateString() === new Date().toDateString() ? clock(last.createdAt) : humanTime(last.createdAt)) : ''}
          </span>
          {unread ? <span className="pl-unread">{unread}</span> : null}
        </span>
      </a>
    );
  }

  openReports() {
    this.tab = 'reports';
    this.reports = null;
    api.reports().then((r) => {
      this.reports = r.reports;
      m.redraw();
    });
  }

  reportsList() {
    if (!this.reports) return <LoadingIndicator />;
    if (!this.reports.length) return <p className="pl-guests">{t('no_reports')}</p>;

    return this.reports.map((r) => (
      <div className="pl-report-card">
        <div className="pl-report-meta">
          {t('reported_by', { reporter: r.reporter?.displayName || '?', reported: r.reported?.displayName || '?' })} · {humanTime(r.createdAt)}
        </div>
        {r.reason ? <p className="pl-report-reason">“{r.reason}”</p> : null}
        <div className="pl-report-snapshot">
          {r.snapshot.map((m2) => (
            <div className={'pl-snap' + (m2.reported ? ' reported' : '')}>
              <b>{m2.user?.displayName || '?'}</b> <span className="pl-mono">{clock(m2.createdAt)}</span>
              <div>
                {m2.body ??
                  (m2.type === 'image'
                    ? extractText(app.translator.trans('ernestdefoe-parley.forum.window.photo'))
                    : extractText(app.translator.trans('ernestdefoe-parley.forum.window.deleted')))}
              </div>
            </div>
          ))}
        </div>
        <button
          className="Button"
          onclick={() =>
            api.resolve(r.id).then((res) => {
              this.reports = res.reports;
              m.redraw();
            })
          }
        >
          {t('resolve')}
        </button>
      </div>
    ));
  }
}
