import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import PersonRow from './PersonRow';
import RoomRow from './RoomRow';
import StatusMenu, { statusColor } from './StatusMenu';
import { activityLine, ownActivity } from './activity';
import Icons from '../icons';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * The social panel down the right of the page: you and your status, a search,
 * the people you follow, then everyone else online.
 */
export default class Rail extends Component {
  view() {
    const s = app.parley;
    const me = s.me;
    const status = s.chosenStatus === 'online' && s.idle ? 'away' : s.chosenStatus;
    const f = s.filter.trim().toLowerCase();
    const match = (p) => !f || p.displayName.toLowerCase().includes(f) || p.username.toLowerCase().includes(f) || (p.activity?.label || '').toLowerCase().includes(f);
    const order = { online: 0, busy: 1, away: 2, offline: 3 };
    const sort = (list) => [...list].sort((a, b) => order[a.status] - order[b.status] || a.displayName.localeCompare(b.displayName));

    const following = sort([...s.online.filter((p) => p.following), ...s.followingOffline].filter(match));
    const rest = sort(s.online.filter((p) => !p.following && match(p)));
    const listedIds = new Set([...s.online, ...s.followingOffline].map((p) => p.id));
    const others = s.found.filter((p) => !listedIds.has(p.id));
    const followingActive = following.filter((p) => p.status !== 'away' && p.status !== 'offline').length;

    const meCard = { displayName: me.displayName(), username: me.username(), avatarUrl: me.avatarUrl() };

    return (
      <aside className="pl-rail" aria-label={extractText(t('rail.label'))}>
        <div className="pl-me">
          {Avatar(meCard, 40, { dot: true, status: status === 'invisible' ? 'offline' : status })}
          <div className="pl-who">
            <div className="pl-nm">{meCard.displayName}</div>
            <div className="pl-me-line">
            <button
              className="pl-status-btn"
              aria-haspopup="menu"
              aria-expanded={String(s.statusMenu)}
              onclick={() => {
                s.statusMenu = !s.statusMenu;
              }}
            >
              <i style={{ background: statusColor(status) }} />
              {t('status.' + status)} {Icons.chev()}
            </button>
            {this.ownLine()}
            </div>
          </div>
          <button className="pl-ib" title={extractText(t('rail.hide'))} aria-label={extractText(t('rail.hide'))} onclick={() => s.toggleRail()}>
            {Icons.x()}
          </button>
        </div>

        {s.statusMenu ? <StatusMenu /> : null}

        <label className="pl-search">
          <span className="pl-sr">{t('rail.search')}</span>
          {Icons.search()}
          <input
            id="Parley-search"
            placeholder={extractText(t('rail.search'))}
            value={s.filter}
            autocomplete="off"
            oninput={(e) => s.search(e.target.value)}
          />
        </label>

        <div className="pl-rail-scroll">
          {this.rooms(f)}
          {following.length || !f ? this.section('follow', t('rail.following'), `${followingActive}/${following.length}`, following, t('rail.following_empty')) : null}
          {this.section('all', t('rail.online_now'), String(rest.length), rest, f ? t('rail.nobody_matches') : t('rail.nobody_online'))}
          {s.sections.all && !f && (s.more || s.guests) ? (
            <div className="pl-guests">
              {s.more ? t('rail.and_more', { count: s.more }) : null}
              {s.more && s.guests ? ' · ' : null}
              {s.guests ? t('rail.guests_reading', { count: s.guests }) : null}
            </div>
          ) : null}
          {others.length ? this.section('others', t('rail.other_members'), String(others.length), others.map((p) => ({ ...p, status: p.online ? 'online' : 'offline', activity: null })), null) : null}
        </div>

        <div className="pl-rail-foot">
          <span>{status === 'invisible' ? t('rail.you_appear_offline') : t('rail.visible_as', { status: extractText(t('status.' + status)) })}</span>
          <span>{t('rail.counts', { members: s.onlineCount(), guests: s.guests })}</span>
        </div>
      </aside>
    );
  }

  /**
   * What you are doing, beside your status: the same line others see for you,
   * worked out here so it changes the moment you move.
   */
  ownLine() {
    const a = ownActivity();
    if (!a) return null;
    return <span className="pl-me-act">{' · '}{activityLine({ status: 'online', activity: a })}</span>;
  }

  /** Rooms first: they are where the forum talks together. */
  rooms(f) {
    const s = app.parley;
    const match = (r) => !f || r.name.toLowerCase().includes(f) || (r.description || '').toLowerCase().includes(f);
    const top = s.rooms.filter((r) => !r.parentId);
    // A search reaches into opened conferences too.
    const rooms = top.filter((r) => match(r) || (s.childRooms[r.id] || []).some(match));
    if (!rooms.length) return null;
    const open = s.sections.rooms !== false;
    const online = rooms.reduce((a, r) => a + (r.online || 0), 0);

    return [
      <button className="pl-sec-h" aria-expanded={String(open)} onclick={() => (s.sections.rooms = !open)}>
        {Icons.chev()} {t('rooms.title')} <span className="pl-c">{online ? online + ' ' + extractText(t('rooms.here')) : rooms.length}</span>
      </button>,
      open
        ? rooms.flatMap((r) => {
            const children = s.expanded.has(r.id) || f ? (s.childRooms[r.id] || []).filter(match) : [];
            // A closed conference shows none of its teams, joined or not; their
            // unread rolls up into the conference's own badge instead.
            return [<RoomRow key={'room-' + r.id} room={r} />, ...children.map((c) => <RoomRow key={'room-' + c.id} room={c} child={true} />)];
          })
        : null,
    ];
  }

  section(key, title, count, people, empty) {
    const s = app.parley;
    const open = s.sections[key] !== false;

    return [
      <button className="pl-sec-h" aria-expanded={String(open)} onclick={() => (s.sections[key] = !open)}>
        {Icons.chev()} {title} <span className="pl-c">{count}</span>
      </button>,
      open
        ? people.length
          ? people.map((p) => <PersonRow key={p.id} person={p} unread={this.unreadWith(p.id)} />)
          : empty
            ? <div className="pl-guests">{empty}</div>
            : null
        : null,
    ];
  }

  unreadWith(userId) {
    const s = app.parley;
    for (const c of s.convs.values()) {
      if (!c.summary.isGroup && c.summary.participants.some((p) => p.id === userId)) return s.unread[c.summary.id] || 0;
    }
    return 0;
  }
}
