import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Dropdown from 'flarum/common/components/Dropdown';
import Button from 'flarum/common/components/Button';
import Separator from 'flarum/common/components/Separator';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import { Face } from './Avatar';
import RoomTile from './RoomTile';
import ChatWindow from './ChatWindow';
import Details from './Details';
import Icons from '../icons';
import api from '../api';
import { clock } from '../util';
import { convTitle, messagePreview } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.inbox.' + key, params);
const tw = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

const MORE = ['mentions', 'pinned', 'starred', 'muted', 'archived', 'requests'];

/**
 * /parley — the messenger. Conversations down the left, the open one in the
 * middle, its details on the right when asked for. On a phone the list and
 * the conversation are two screens, each the full width.
 *
 * Loaded when someone first comes here; nothing of it is on other pages.
 */
export default class InboxPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'Parley-inboxPage';
    this.filter = 'all';
    this.lists = {};
    this.query = '';
    this.found = null;
    this.reports = null;
    // Open by default only where the conversation keeps a comfortable width
    // beside it; after that, whatever the member last chose.
    let saved = null;
    try {
      saved = localStorage.getItem('parley:details');
    } catch (e) {
      // No storage: the default stands.
    }
    // null: not chosen yet, so it opens where there is room for it.
    this.details = saved === null ? null : saved === '1';
    this.selected = Number(m.route.param('id')) || null;

    app.setTitle(extractText(t('title')));
    app.setTitleCount(0);

    if (!app.parley) return;

    app.parley.pageConversation = this.selected;
    if (this.selected) {
      app.parley.touchRoom(this.selected);
      app.parley.select(this.selected);
    }
    this.seenVersion = app.parley.listVersion || 0;
    this.fetch('all');
  }

  onbeforeupdate(vnode) {
    super.onbeforeupdate(vnode);
    const s = app.parley;
    if (!s) return;

    const id = Number(m.route.param('id')) || null;
    if (id !== this.selected) {
      this.selected = id;
      s.pageConversation = id;
      if (id) {
        s.select(id);
        s.touchRoom(id);
      }
    }

    // Something changed the list elsewhere: fetch the one on show again.
    if ((s.listVersion || 0) !== this.seenVersion) {
      this.seenVersion = s.listVersion || 0;
      clearTimeout(this.refetch);
      this.refetch = setTimeout(() => this.fetch(this.filter, true), 600);
    }
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (app.parley) app.parley.pageConversation = null;
  }

  fetch(filter, quiet = false, more = false) {
    const list = (this.lists[filter] ||= { items: [], hasMore: false, loading: true });
    if (!quiet) list.loading = true;
    const offset = more ? list.items.length : 0;

    return api.conversations(filter, offset).then((r) => {
      r.conversations.forEach((c) => app.parley.ensure(c));
      list.items = more ? [...list.items, ...r.conversations] : r.conversations;
      list.hasMore = r.hasMore;
      list.loading = false;
      m.redraw();
    });
  }

  setFilter(filter) {
    this.filter = filter;
    this.found = null;
    if (filter === 'reports') return this.openReports();
    if (!this.lists[filter]) this.fetch(filter);
    else this.fetch(filter, true);
  }

  view() {
    if (!app.parley) {
      return (
        <div className="ParleyPage">
          <div className="container">
            <div className="Parley pl-noaccess">
              {Icons.msg()}
              {app.session.user ? (
                <p>{t('no_access')}</p>
              ) : (
                [
                  <p>{t('log_in_to_message')}</p>,
                  <Button className="Button Button--primary" onclick={() => app.modal.show(() => import('flarum/forum/components/LogInModal'))}>
                    {app.translator.trans('core.forum.header.log_in_link')}
                  </Button>,
                ]
              )}
            </div>
          </div>
        </div>
      );
    }

    const s = app.parley;
    const open = this.selected && s.conv(this.selected);
    // Room is measured on the messenger itself: a theme's own side columns
    // can leave it far narrower than the window.
    const roomy = (this.width || 0) >= 1180;
    const showDetails = (this.details === null ? roomy : this.details) && open;

    return (
      <div className="ParleyPage">
        <div className="container">
          <div className="pl-shell" oncreate={(v) => this.measure(v.dom)} onupdate={(v) => this.measure(v.dom)}>
            <div className={'Parley pl-messenger' + (this.selected ? ' has-selected' : '') + (showDetails ? ' has-details' : '')}>
              <aside className="pl-list">{this.listColumn()}</aside>
              <main className="pl-chat">
                {this.selected ? (
                  <ChatWindow
                    key={this.selected}
                    id={this.selected}
                    page={true}
                    detailsOpen={showDetails}
                    ondetails={() => this.toggleDetails()}
                    onback={() => m.route.set(app.route('parley.inbox'))}
                  />
                ) : (
                  <div className="pl-pick">
                    {Icons.msg()}
                    <p>{t('pick')}</p>
                    <Button className="Button Button--primary" icon="fas fa-pen-to-square" onclick={() => this.compose()}>
                      {t('new_message')}
                    </Button>
                  </div>
                )}
              </main>
              {/* 🚨 Its own wrapper: a keyed child beside unkeyed ones, or a
                null hole in a keyed list, is the Mithril mixed-keys throw. */}
              <div className="pl-details-slot">
                {showDetails ? <Details key={'d' + this.selected} id={this.selected} onclose={() => this.toggleDetails(false)} /> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  measure(el) {
    const width = el.clientWidth;
    if (width !== this.width) {
      this.width = width;
      // Measured after a draw: draw again only when the answer changed.
      setTimeout(m.redraw, 0);
    }
  }

  toggleDetails(open) {
    this.details = open ?? !(this.details === null ? (this.width || 0) >= 1180 : this.details);
    try {
      localStorage.setItem('parley:details', this.details ? '1' : '0');
    } catch (e) {
      // Remembered for the page only.
    }
  }

  compose(members = null) {
    app.modal.show(() => import('./NewConversationModal'), members ? { conversationId: this.selected, members } : {});
  }

  // ── The list column ───────────────────────────────────────────────────────

  listColumn() {
    const s = app.parley;
    const moreActive = MORE.includes(this.filter) || this.filter === 'reports';

    return [
      <div className="pl-list-head">
        <h2>{t('title')}</h2>
        <Button
          className="Button Button--icon Button--flat"
          icon="fas fa-pen-to-square"
          aria-label={extractText(t('new_message'))}
          title={extractText(t('new_message'))}
          onclick={() => this.compose()}
        />
      </div>,
      <form className="pl-list-search" role="search" onsubmit={(e) => this.searchMessages(e)}>
        {Icons.search()}
        <input
          className="FormControl"
          type="search"
          placeholder={extractText(t('search'))}
          aria-label={extractText(t('search'))}
          value={this.query}
          oninput={(e) => {
            this.query = e.target.value;
            if (!this.query.trim()) this.found = null;
          }}
        />
      </form>,
      <div className="pl-filters" role="tablist">
        {['all', 'unread', 'groups'].map((f) => (
          <button
            role="tab"
            className={'pl-pill' + (this.filter === f ? ' active' : '')}
            aria-selected={String(this.filter === f)}
            onclick={() => this.setFilter(f)}
          >
            {t('filter_' + f)}
          </button>
        ))}
        <Dropdown
          className="pl-more-filter"
          buttonClassName={'pl-pill' + (moreActive ? ' active' : '')}
          label={[
            moreActive ? t('filter_' + this.filter) : t('more'),
            s.requests && this.filter !== 'requests' ? <span className="pl-dotcount">{s.requests}</span> : null,
          ]}
          caretIcon="fas fa-caret-down"
          accessibleToggleLabel={extractText(t('more'))}
        >
          {MORE.map((f) => (
            <Button icon={moreIcon(f)} active={this.filter === f} onclick={() => this.setFilter(f)}>
              {t('filter_' + f)}
              {f === 'requests' && s.requests ? <span className="pl-count">{s.requests}</span> : null}
            </Button>
          ))}
          {s.config.canModerate ? <Separator /> : null}
          {s.config.canModerate ? (
            <Button icon="fas fa-flag" active={this.filter === 'reports'} onclick={() => this.setFilter('reports')}>
              {t('reports')}
            </Button>
          ) : null}
        </Dropdown>
      </div>,
      <div className="pl-list-scroll">{this.listBody()}</div>,
    ];
  }

  listBody() {
    if (this.filter === 'reports') return this.reportsList();
    if (this.found) return this.searchResults();

    const s = app.parley;
    const list = this.lists[this.filter];
    if (!list || (list.loading && !list.items.length)) return <LoadingIndicator />;

    const q = this.query.trim().toLowerCase();
    // What the list holds, with each conversation as this page knows it now.
    const items = list.items
      .map((c) => s.conv(c.id)?.summary || c)
      .filter((c) => this.stillBelongs(c))
      .filter((c) => !q || convTitle(c).toLowerCase().includes(q) || (c.participants || []).some((p) => p.username.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    return [
      this.filter === 'all' && !q ? this.roomsList() : null,
      this.filter === 'all' && !q && s.rooms.length ? <div className="pl-list-sec">{t('direct')}</div> : null,
      this.filter === 'requests' && items.length ? <p className="pl-list-note">{t('requests_note')}</p> : null,
      items.length ? items.map((c) => this.item(c)) : <p className="pl-list-empty">{q ? t('no_matches') : t('empty_' + this.filter)}</p>,
      q.length >= 2 ? (
        <button className="pl-search-all" onclick={(e) => this.searchMessages(e)}>
          {Icons.search()} {t('search_messages_for', { q: this.query.trim() })}
        </button>
      ) : null,
      list.hasMore && !q ? (
        <Button className="Button Button--block pl-load-more" onclick={() => this.fetch(this.filter, true, true)}>
          {t('load_more')}
        </Button>
      ) : null,
    ];
  }

  /** Filed somewhere else since the list was fetched: leave it out until the refetch. */
  stillBelongs(c) {
    switch (this.filter) {
      case 'requests':
        return !!c.request;
      case 'archived':
        return !!c.archived;
      case 'starred':
        return !!c.starred;
      case 'muted':
        return !!c.muted;
      default:
        return !c.archived && !c.request;
    }
  }

  /** Rooms first, in the admin's order, with what is unread in each. */
  roomsList() {
    const s = app.parley;
    if (!s.rooms.length) return null;

    return [
      <div className="pl-list-sec">{t('rooms')}</div>,
      // Conferences, then the team rooms you have joined, each under its own.
      s.rooms
        .filter((r) => !r.parentId)
        .flatMap((p) => [p, ...s.rooms.filter((c) => c.parentId === p.id)])
        .map((r) => (
          <a
            className={'pl-item' + (r.parentId ? ' child' : '') + (r.id === this.selected ? ' active' : '') + (r.unread ? ' unread' : '')}
            href={app.route('parley.conversation', { id: r.id })}
            onclick={(e) => {
              e.preventDefault();
              const go = () => m.route.set(app.route('parley.conversation', { id: r.id }));
              r.joined ? go() : app.parley.openRoom(r.id).then(go);
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
            <span className="pl-meta">{r.unread ? <span className="pl-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}</span>
          </a>
        )),
    ];
  }

  item(c) {
    const s = app.parley;
    const last = c.lastMessage;
    const mine = last && last.userId === Number(app.session.user.id());
    const unread = s.unread[c.id] ?? c.unread ?? 0;
    const draft = c.id !== this.selected && s.drafts[c.id];
    const when = last
      ? new Date(last.createdAt).toDateString() === new Date().toDateString()
        ? clock(last.createdAt)
        : humanTime(last.createdAt)
      : '';

    return (
      <div className={'pl-item' + (c.id === this.selected ? ' active' : '') + (unread ? ' unread' : '') + (c.muted ? ' muted' : '')}>
        <a
          className="pl-item-link"
          href={app.route('parley.conversation', { id: c.id })}
          onclick={(e) => {
            e.preventDefault();
            m.route.set(app.route('parley.conversation', { id: c.id }));
          }}
        >
          {Face(c, 46, s.presenceOf.bind(s))}
          <span className="pl-info">
            <span className="pl-nm">
              {c.label ? <i className={'pl-label pl-label--' + c.label} aria-label={extractText(t('label_' + c.label))} /> : null}
              <span>{convTitle(c)}</span>
              {c.starred ? <span className="pl-flag">{Icons.star()}</span> : null}
              {c.muted ? <span className="pl-flag">{Icons.muted()}</span> : null}
            </span>
            <span className="pl-act">
              {draft
                ? [<b className="pl-draft">{t('draft')}</b>, ' ', draft]
                : [c.mentioned ? <b className="pl-at">@ </b> : null, mine && last.type !== 'system' ? [t('you'), ': '] : null, messagePreview(last)]}
            </span>
          </span>
          <span className="pl-meta">
            <span className="pl-when">{when}</span>
            {unread ? <span className="pl-unread">{unread > 99 ? '99+' : unread}</span> : null}
          </span>
        </a>
        {c.type !== 'room' ? this.itemMenu(c) : null}
      </div>
    );
  }

  itemMenu(c) {
    const s = app.parley;
    const labels = s.config.labels || [];

    return (
      <Dropdown
        className="pl-item-menu"
        buttonClassName="Button Button--icon Button--flat"
        icon="fas fa-ellipsis-h"
        label={extractText(t('options'))}
        accessibleToggleLabel={extractText(t('options'))}
        menuClassName="Dropdown-menu--right"
      >
        {c.request ? (
          <Button icon="fas fa-check" onclick={() => s.accept(c.id)}>
            {tw('accept')}
          </Button>
        ) : null}
        <Button icon={c.starred ? 'far fa-star' : 'fas fa-star'} onclick={() => s.file(c.id, { starred: !c.starred })}>
          {c.starred ? t('unstar') : t('star')}
        </Button>
        <Button icon={c.muted ? 'fas fa-bell' : 'fas fa-bell-slash'} onclick={() => s.file(c.id, { muted: !c.muted })}>
          {c.muted ? t('unmute') : t('mute')}
        </Button>
        <Button icon="fas fa-archive" onclick={() => s.file(c.id, { archived: !c.archived })}>
          {c.archived ? t('unarchive') : t('archive')}
        </Button>
        <Separator />
        <div className="pl-label-pick" role="group" aria-label={extractText(t('label'))}>
          {labels.map((l) => (
            <button
              className={'pl-label pl-label--' + l + (c.label === l ? ' on' : '')}
              aria-label={extractText(t('label_' + l))}
              title={extractText(t('label_' + l))}
              aria-pressed={String(c.label === l)}
              onclick={() => s.file(c.id, { label: c.label === l ? null : l })}
            />
          ))}
        </div>
        <Separator />
        <Button icon="far fa-trash-alt" onclick={() => s.hide(c.id)}>
          {t('delete')}
        </Button>
      </Dropdown>
    );
  }

  // ── Searching messages ────────────────────────────────────────────────────

  searchMessages(e, extra = {}) {
    e && e.preventDefault();
    const q = this.query.trim();
    this.found = { ...(this.found || {}), ...extra, q, loading: true };
    const f = this.found;
    if (q.length < 2 && !f.type && !f.from && !f.since && !f.until) {
      this.found = q ? this.found : null;
      if (this.found) this.found.loading = false;
      return;
    }

    api.search({ q, type: f.type, from: f.from, since: f.since, until: f.until }).then((r) => {
      if (this.found !== f) return;
      f.loading = false;
      f.messages = r.messages;
      f.conversations = Object.fromEntries(r.conversations.map((c) => [c.id, c]));
      m.redraw();
    });
  }

  searchResults() {
    const f = this.found;
    const s = app.parley;
    // Everyone this page knows, to search by.
    const people = new Map();
    [...s.convs.values()].forEach((c) => (c.summary.participants || []).forEach((p) => people.set(p.id, p)));

    return [
      <div className="pl-search-filters">
        <select
          className="FormControl"
          aria-label={extractText(t('search_type'))}
          value={f.type || ''}
          onchange={(e) => this.searchMessages(null, { type: e.target.value || null })}
        >
          <option value="">{t('type_any')}</option>
          {['text', 'media', 'voice', 'file', 'link'].map((x) => (
            <option value={x}>{t('type_' + x)}</option>
          ))}
        </select>
        <select
          className="FormControl"
          aria-label={extractText(t('search_from'))}
          value={f.from || ''}
          onchange={(e) => this.searchMessages(null, { from: Number(e.target.value) || null })}
        >
          <option value="">{t('from_anyone')}</option>
          <option value={app.session.user.id()}>{t('from_me')}</option>
          {[...people.values()]
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((p) => (
              <option value={p.id}>{p.displayName}</option>
            ))}
        </select>
        <label>
          <span>{t('since')}</span>
          <input
            type="date"
            className="FormControl"
            value={f.since || ''}
            onchange={(e) => this.searchMessages(null, { since: e.target.value || null })}
          />
        </label>
        <label>
          <span>{t('until')}</span>
          <input
            type="date"
            className="FormControl"
            value={f.until || ''}
            onchange={(e) => this.searchMessages(null, { until: e.target.value || null })}
          />
        </label>
        <Button className="Button Button--link" onclick={() => (this.found = null)}>
          {t('close_search')}
        </Button>
      </div>,
      f.loading ? (
        <LoadingIndicator />
      ) : !f.messages || !f.messages.length ? (
        <p className="pl-list-empty">{t('no_results')}</p>
      ) : (
        f.messages.map((msg) => {
          const c = f.conversations[msg.conversationId];
          if (!c) return null;
          return (
            <a
              className="pl-item pl-hit"
              href={app.route('parley.conversation', { id: c.id })}
              onclick={(e) => {
                e.preventDefault();
                // Already open: jump in place; otherwise open it there.
                c.id === this.selected ? s.load(c.id, { around: msg.id }) : s.openAt(c.id, msg.id);
              }}
            >
              {c.type === 'room' ? RoomTile(c.room || {}, 40) : Face(c, 40)}
              <span className="pl-info">
                <span className="pl-nm">
                  <span>{convTitle(c)}</span>
                </span>
                <span className="pl-act">
                  {msg.author ? <b>{msg.author.displayName}: </b> : null}
                  {messagePreview(msg)}
                </span>
              </span>
              <span className="pl-meta">
                <span className="pl-when">{humanTime(msg.createdAt)}</span>
              </span>
            </a>
          );
        })
      ),
    ];
  }

  // ── Reports, for moderators ───────────────────────────────────────────────

  openReports() {
    this.reports = null;
    api.reports().then((r) => {
      this.reports = r.reports;
      m.redraw();
    });
  }

  reportsList() {
    if (!this.reports) return <LoadingIndicator />;
    if (!this.reports.length) return <p className="pl-list-empty">{t('no_reports')}</p>;

    return this.reports.map((r) => (
      <div className="pl-report-card">
        <div className="pl-report-meta">
          {t('reported_by', { reporter: r.reporter?.displayName || '?', reported: r.reported?.displayName || '?' })} · {humanTime(r.createdAt)}
        </div>
        {r.reason ? <p className="pl-report-reason">“{r.reason}”</p> : null}
        <div className="pl-report-snapshot">
          {r.snapshot.map((m2) => (
            <div className={'pl-snap' + (m2.reported ? ' reported' : '')}>
              <b>{m2.user?.displayName || '?'}</b> <span className="pl-when">{clock(m2.createdAt)}</span>
              <div>{m2.body ?? messagePreview({ ...m2, deleted: m2.body === null && m2.type === 'text' })}</div>
            </div>
          ))}
        </div>
        <Button
          className="Button"
          onclick={() =>
            api.resolve(r.id).then((res) => {
              this.reports = res.reports;
              m.redraw();
            })
          }
        >
          {t('resolve')}
        </Button>
      </div>
    ));
  }
}

function moreIcon(filter) {
  return {
    mentions: 'fas fa-at',
    pinned: 'fas fa-thumbtack',
    starred: 'fas fa-star',
    muted: 'fas fa-bell-slash',
    archived: 'fas fa-archive',
    requests: 'fas fa-inbox',
  }[filter];
}
