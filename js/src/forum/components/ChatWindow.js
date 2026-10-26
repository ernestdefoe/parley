import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import { Face } from './Avatar';
import RoomTile from './RoomTile';
import Icons from '../icons';
import api from '../api';
import { presenceLine } from './activity';
import { convTitle, messagePreview } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** The messages and the composer, fetched once, the first time a window opens. */
let Body = null;
let loading = null;
function body() {
  if (!Body && !loading) {
    loading = import('./ChatBody').then((mod) => {
      Body = mod;
      m.redraw();
    });
  }
  return Body;
}

/**
 * A conversation: header, pinned bar, messages, composer. Docked as a mini
 * window on every page, and full size on the messages page (`page`), where
 * the header also opens the details column.
 *
 * Parley Calls adds its buttons through headerItems() and a room's voice bar
 * through bodyTopItems(); both stay where they were.
 */
export default class ChatWindow extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.reportReason = '';
    this.searching = false;
    this.search = { q: '', results: null, index: 0 };
    this.pinIndex = 0;
  }

  view() {
    const s = app.parley;
    const id = this.attrs.id;
    const conv = s.conv(id);
    const page = !!this.attrs.page;
    const min = !page && s.minimised.has(id);

    if (!conv) {
      return (
        <section className={'pl-win pl-loading' + (page ? ' page' : '')} aria-busy="true">
          <div className="pl-w-head">
            <span className="pl-skel" />
          </div>
        </section>
      );
    }

    const summary = conv.summary;
    const isRoom = summary.type === 'room';
    const room = isRoom ? { ...(summary.room || {}), ...(s.room(id) || {}) } : null;
    const peer = summary.participants[0] || { displayName: '?' };
    const live = { ...peer, ...s.presenceOf(peer.id) };
    const title = isRoom ? room.name : convTitle(summary);
    const status = isRoom
      ? [
          room.online ? extractText(app.translator.trans('ernestdefoe-parley.forum.rooms.online_count', { count: room.online })) : null,
          room.members !== undefined
            ? extractText(app.translator.trans('ernestdefoe-parley.forum.rooms.members_count', { count: room.members }))
            : null,
        ]
          .filter(Boolean)
          .join(' · ') ||
        room.description ||
        ''
      : summary.isGroup
        ? extractText(t('members_count', { count: summary.memberCount || summary.participants.length + 1 }))
        : presenceLine(live);
    const canPost = !isRoom || !room.readonly || s.config.canModerate;
    const replying = s.replyTo[id];
    const editing = s.editing[id];
    const reporting = s.reporting && s.reporting.conversationId === id ? s.reporting.message : null;

    return (
      <section
        className={'pl-win' + (min ? ' min' : '') + (s.flash.has(id) ? ' flash' : '') + (page ? ' page' : '')}
        aria-label={extractText(t('label', { name: title }))}
      >
        <div className="pl-w-head">
          {page && this.attrs.onback ? (
            <button className="pl-ib pl-back" aria-label={extractText(t('back'))} title={extractText(t('back'))} onclick={this.attrs.onback}>
              {Icons.back()}
            </button>
          ) : null}
          {isRoom ? RoomTile(room, 34) : Face(summary, 34, s.presenceOf.bind(s))}
          <div
            className="pl-who"
            role="button"
            tabindex="0"
            onclick={() => (page ? this.attrs.ondetails && this.attrs.ondetails() : s.toggleMinimised(id))}
          >
            <div className="pl-nm">{title}</div>
            <div className="pl-st">{status}</div>
          </div>
          {this.headerRows(conv, live, page)}
        </div>

        {min ? null : body() ? (
          [
            // 🚨 Its own wrapper: as bars come and go here (pins, search,
            // a room's voice bar) the message list must keep its place,
            // or Mithril rebuilds it and an open menu and the scroll
            // position are lost.
            <div className="pl-w-top">{this.bodyTopItems(conv).toArray()}</div>,
            <Body.MessageList conv={conv} />,
            this.bottom(conv, { canPost, replying, editing, reporting, title }),
          ]
        ) : (
          <div className="pl-w-body pl-loading-body" aria-busy="true" />
        )}
      </section>
    );
  }

  bottom(conv, { canPost, replying, editing, reporting, title }) {
    const s = app.parley;
    const id = conv.summary.id;

    return [
      conv.summary.request ? this.requestBar(conv) : null,
      reporting ? this.reportBar(reporting) : null,
      replying || editing ? (
        <div className="pl-replying">
          <span>
            {editing
              ? t('editing')
              : t('replying_to', {
                  text: replying.type === 'text' ? replying.body : messagePreview(replying),
                })}
          </span>
          <button
            className="pl-ib"
            aria-label={extractText(t('cancel'))}
            onclick={() => {
              delete s.replyTo[id];
              delete s.editing[id];
            }}
          >
            {Icons.x()}
          </button>
        </div>
      ) : null,
      canPost ? (
        <Body.Composer conv={conv} title={title} />
      ) : (
        <div className="pl-readonly">{app.translator.trans('ernestdefoe-parley.forum.rooms.readonly_note')}</div>
      ),
    ];
  }

  /**
   * A mini window is narrow: with Calls' two buttons, search and expand
   * beside minimise and close, the name was cut to a few letters. So the
   * window's own controls stay on the name's row and every other button
   * sits on a row of its own under the name. The messages page has the
   * room for one row.
   */
  headerRows(conv, live, page) {
    const items = this.headerItems(conv, live);
    if (page) return items.toArray();

    const controls = new ItemList();
    ['minimise', 'close'].forEach((key) => {
      if (items.has(key)) {
        controls.add(key, items.get(key), items.getPriority(key));
        items.remove(key);
      }
    });

    return [items.isEmpty() ? null : <div className="pl-w-actions">{items.toArray()}</div>, controls.toArray()];
  }

  /**
   * The header buttons. Parley Calls adds voice and video in front of these,
   * at priority 100 and 90.
   */
  headerItems(conv, live) {
    const s = app.parley;
    const id = conv.summary.id;
    const page = !!this.attrs.page;
    const items = new ItemList();
    const button = (key, icon, label, onclick, priority, extra = {}) =>
      items.add(
        key,
        <button
          className={'pl-ib' + (extra.on ? ' on' : '')}
          data-item={key}
          aria-label={extractText(label)}
          title={extractText(label)}
          aria-pressed={extra.pressed}
          onclick={onclick}
        >
          {icon}
        </button>,
        priority
      );

    button('search', Icons.search(), t('search_in_chat'), () => this.toggleSearch(), 50, { on: this.searching, pressed: String(this.searching) });

    if (page) {
      button('details', Icons.info(), t('details'), () => this.attrs.ondetails && this.attrs.ondetails(), 30, {
        on: this.attrs.detailsOpen,
        pressed: String(!!this.attrs.detailsOpen),
      });
    }

    if (conv.summary.type === 'room') {
      button('leave', Icons.door(), t('leave_room'), () => s.leaveRoom(id), -5);
    }

    if (page) return items;

    button('expand', Icons.expand(), t('expand'), () => s.expand(id), -8);
    button('minimise', Icons.min(), t('minimise'), () => s.toHead(id), -10);
    button('close', Icons.x(), t('close'), () => s.close(id), -20);

    return items;
  }

  /**
   * Drawn between the header and the messages: the pinned bar and the
   * search bar. Parley Calls puts a room's voice bar here too.
   */
  bodyTopItems(conv) {
    const items = new ItemList();
    if (this.searching) items.add('search', this.searchBar(conv), 20);
    if (conv.summary.pinCount) items.add('pins', this.pinBar(conv), 10);
    return items;
  }

  // ── Pins ──────────────────────────────────────────────────────────────────

  pinBar(conv) {
    const s = app.parley;
    const id = conv.summary.id;

    if (!conv.pins && !conv.loadingPins) {
      conv.loadingPins = true;
      api.details(id, 'pins').then((r) => {
        conv.pins = r.items || [];
        conv.loadingPins = false;
        if (r.members) s.members[id] = r.members;
        m.redraw();
      });
    }

    const pins = conv.pins || [];
    if (!pins.length) return null;
    const i = this.pinIndex % pins.length;
    const pin = pins[i];

    return (
      <button
        className="pl-pinbar"
        onclick={() => {
          this.goTo(conv, pin.id);
          this.pinIndex = i + 1;
        }}
      >
        {Icons.pin()}
        <span className="pl-pinbar-text">
          <b>{pins.length > 1 ? t('pinned_count', { index: i + 1, count: pins.length }) : t('pinned')}</b>
          <span>{messagePreview(pin)}</span>
        </span>
      </button>
    );
  }

  /** Scroll to a message, fetching the page around it when it is not drawn. */
  goTo(conv, messageId) {
    if (conv.messages.some((x) => x.id === messageId)) {
      conv.jumpTo = messageId;
      m.redraw();
    } else {
      app.parley.load(conv.summary.id, { around: messageId });
    }
  }

  // ── Search in this conversation ──────────────────────────────────────────

  toggleSearch() {
    this.searching = !this.searching;
    this.search = { q: '', results: null, index: 0 };
    if (this.searching) setTimeout(() => document.getElementById(`Parley-find-${this.attrs.id}`)?.focus(), 0);
  }

  searchBar(conv) {
    const r = this.search.results;
    const run = (e) => {
      e.preventDefault();
      const q = this.search.q.trim();
      if (q.length < 2) return;
      api.search({ q, conversation: conv.summary.id }).then((res) => {
        this.search.results = res.messages;
        this.search.index = 0;
        if (res.messages.length) this.goTo(conv, res.messages[0].id);
        m.redraw();
      });
    };
    const step = (d) => {
      if (!r || !r.length) return;
      this.search.index = (this.search.index + d + r.length) % r.length;
      this.goTo(conv, r[this.search.index].id);
    };

    return (
      <form className="pl-findbar" onsubmit={run}>
        {Icons.search()}
        <input
          id={`Parley-find-${conv.summary.id}`}
          className="FormControl"
          placeholder={extractText(t('search_in_chat'))}
          value={this.search.q}
          oninput={(e) => {
            this.search.q = e.target.value;
            this.search.results = null;
          }}
          onkeydown={(e) => {
            // 🚨 Not `e.key === 'Escape' && …`: a handler that returns false
            // makes Mithril cancel the key, and nothing could be typed.
            if (e.key === 'Escape') this.toggleSearch();
          }}
        />
        {r ? (
          <span className="pl-find-count">{r.length ? t('result_of', { index: this.search.index + 1, count: r.length }) : t('no_results')}</span>
        ) : null}
        {r && r.length > 1 ? (
          <span className="pl-find-steps">
            {/* Results run newest first, so "older" moves down the list. */}
            <button type="button" className="pl-ib" aria-label={extractText(t('older_result'))} onclick={() => step(1)}>
              <i className="fas fa-chevron-up" aria-hidden="true" />
            </button>
            <button type="button" className="pl-ib" aria-label={extractText(t('newer_result'))} onclick={() => step(-1)}>
              <i className="fas fa-chevron-down" aria-hidden="true" />
            </button>
          </span>
        ) : null}
        <button type="button" className="pl-ib" aria-label={extractText(t('close_search'))} onclick={() => this.toggleSearch()}>
          {Icons.x()}
        </button>
      </form>
    );
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  /** A first message from someone you do not follow: accept, delete or block. */
  requestBar(conv) {
    const s = app.parley;
    const id = conv.summary.id;
    const peer = conv.summary.participants[0] || {};
    const name = conv.summary.isGroup ? convTitle(conv.summary) : peer.displayName;

    return (
      <div className="pl-request">
        <p>{conv.summary.isGroup ? t('request_group', { name }) : t('request_from', { name })}</p>
        <p className="helpText">{t('request_help')}</p>
        <div className="pl-request-actions">
          <button className="Button Button--primary" onclick={() => s.accept(id)}>
            {t('accept')}
          </button>
          <button className="Button" onclick={() => s.hide(id)}>
            {t('delete_request')}
          </button>
          {!conv.summary.isGroup && peer.id ? (
            <button className="Button Button--danger" onclick={() => s.block(peer.id, true).then(() => s.hide(id))}>
              {t('block')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  reportBar(message) {
    const s = app.parley;
    const close = () => {
      s.reporting = null;
      this.reportReason = '';
    };

    return (
      <form
        className="pl-report"
        onsubmit={(e) => {
          e.preventDefault();
          api.report(message.id, this.reportReason || null).then(() => {
            close();
            app.alerts.show({ type: 'success' }, t('reported'));
            m.redraw();
          });
        }}
      >
        <p>{t('report_prompt')}</p>
        <input
          id={`Parley-report-${message.id}`}
          className="FormControl"
          placeholder={extractText(t('report_reason'))}
          maxlength="500"
          oninput={(e) => (this.reportReason = e.target.value)}
        />
        <div className="pl-report-actions">
          <button type="button" className="Button" onclick={close}>
            {t('cancel')}
          </button>
          <button className="Button Button--danger">{t('report_send')}</button>
        </div>
      </form>
    );
  }
}
