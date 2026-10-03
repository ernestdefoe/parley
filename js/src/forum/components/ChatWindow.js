import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import RoomTile from './RoomTile';
import MessageList from './MessageList';
import Icons from '../icons';
import api from '../api';
import { presenceLine } from './activity';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * A docked conversation: header, messages, composer. The same component fills
 * the screen on a phone and the right-hand pane of the inbox page.
 */

/** Size the message box to its text, up to its CSS max-height, then scroll. */
function grow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export default class ChatWindow extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.sending = false;
    this.reportReason = '';
  }

  view() {
    const s = app.parley;
    const id = this.attrs.id;
    const conv = s.conv(id);
    const min = !this.attrs.page && s.minimised.has(id);

    if (!conv) {
      return <section className="pl-win pl-loading" aria-busy="true"><div className="pl-w-head"><span className="pl-skel" /></div></section>;
    }

    const isRoom = conv.summary.type === 'room';
    const room = isRoom ? { ...(conv.summary.room || {}), ...(s.room(id) || {}) } : null;
    const peer = conv.summary.participants[0] || { displayName: '?' };
    const live = { ...peer, ...s.presenceOf(peer.id) };
    const title = isRoom ? room.name : conv.summary.isGroup ? conv.summary.title || conv.summary.participants.map((p) => p.displayName).join(', ') : peer.displayName;
    const status = isRoom
      ? [room.online ? extractText(app.translator.trans('ernestdefoe-parley.forum.rooms.online_count', { count: room.online })) : null,
         room.members !== undefined ? extractText(app.translator.trans('ernestdefoe-parley.forum.rooms.members_count', { count: room.members })) : null]
          .filter(Boolean).join(' · ') || room.description || ''
      : presenceLine(live);
    const canPost = !isRoom || !room.readonly || s.config.canModerate;
    const replying = s.replyTo[id];
    const editing = s.editing[id];
    const reporting = s.reporting && s.reporting.conversationId === id ? s.reporting.message : null;

    return (
      <section className={'pl-win' + (min ? ' min' : '') + (s.flash.has(id) ? ' flash' : '') + (this.attrs.page ? ' page' : '')} aria-label={extractText(t('label', { name: title }))}>
        <div className="pl-w-head">
          {isRoom ? RoomTile(room, 32) : Avatar(live, 32, { dot: true })}
          <div className="pl-who" onclick={() => !this.attrs.page && s.toggleMinimised(id)}>
            <div className="pl-nm">{title}</div>
            <div className="pl-st">{status}</div>
          </div>
          {this.headerItems(conv, live).toArray()}
        </div>

        {this.bodyTopItems(conv).toArray()}

        <MessageList conv={conv} />

        {reporting ? this.reportBar(reporting) : null}

        {replying || editing ? (
          <div className="pl-replying">
            <span>{editing ? t('editing') : t('replying_to', { text: replying.body || extractText(t('photo')) })}</span>
            <button aria-label={extractText(t('cancel'))} onclick={() => {
              delete s.replyTo[id];
              delete s.editing[id];
            }}>{Icons.x()}</button>
          </div>
        ) : null}

        {!canPost ? <div className="pl-readonly">{app.translator.trans('ernestdefoe-parley.forum.rooms.readonly_note')}</div> : null}

        <form className={'pl-composer' + (canPost ? '' : ' hidden')} onsubmit={(e) => this.submit(e, conv)}>
          <button type="button" className="pl-ib" title={extractText(t('add_photo'))} aria-label={extractText(t('add_photo'))} onclick={(e) => e.currentTarget.nextElementSibling.click()}>
            {Icons.img()}
          </button>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onchange={(e) => this.upload(e, id)} />
          {/*
            A textarea, so a message can hold line breaks: Enter sends, as it
            always has, and Shift+Enter starts a new line. It grows with what
            is typed, up to a few lines, then scrolls.
          */}
          <textarea
            id={`Parley-input-${id}`}
            rows="1"
            placeholder="Aa"
            autocomplete="off"
            aria-label={extractText(t('message_to', { name: title }))}
            oncreate={(v) => {
              if (editing) v.dom.value = editing.body;
              grow(v.dom);
            }}
            onupdate={(v) => {
              if (editing && v.dom.dataset.editing !== String(editing.id)) {
                v.dom.value = editing.body;
                v.dom.dataset.editing = String(editing.id);
              } else if (!editing && v.dom.dataset.editing) {
                v.dom.value = '';
                delete v.dom.dataset.editing;
              }
              grow(v.dom);
            }}
            oninput={(e) => {
              grow(e.target);
              s.typing(id);
            }}
            onkeydown={(e) => {
              if (e.key === 'Escape') {
                delete s.replyTo[id];
                delete s.editing[id];
                return;
              }

              // 🚨 isComposing: with a Chinese, Japanese or Korean input method,
              // Enter CONFIRMS the character being composed. Sending on it would
              // post half-typed words.
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                e.target.form?.requestSubmit();
              }
            }}
            onfocus={() => s.markRead(id)}
          />
          <button className="pl-ib" aria-label={extractText(t('send'))} title={extractText(t('send'))} disabled={this.sending}>{Icons.send()}</button>
        </form>
      </section>
    );
  }

  /**
   * The header buttons. Parley Calls adds voice and video in front of these,
   * at priority 100 and 90, as in the mockup.
   */
  headerItems(conv, live) {
    const s = app.parley;
    const id = conv.summary.id;
    const items = new ItemList();

    if (conv.summary.type === 'room') {
      items.add('leave', (
        <button className="pl-ib plain" aria-label={extractText(t('leave_room'))} title={extractText(t('leave_room'))} onclick={() => s.leaveRoom(id)}>{Icons.door()}</button>
      ), -5);
    }

    if (this.attrs.page) return items;

    items.add('minimise', (
      <button className="pl-ib plain" aria-label={extractText(t('minimise'))} title={extractText(t('minimise'))} onclick={() => s.toHead(id)}>{Icons.min()}</button>
    ), -10);
    items.add('close', (
      <button className="pl-ib plain" aria-label={extractText(t('close'))} title={extractText(t('close'))} onclick={() => s.close(id)}>{Icons.x()}</button>
    ), -20);

    return items;
  }

  /**
   * Anything drawn between the header and the messages. Empty here; Parley
   * Calls puts a room's voice bar in it.
   */
  bodyTopItems(conv) {
    return new ItemList();
  }

  submit(e, conv) {
    e.preventDefault();
    const s = app.parley;
    const id = conv.summary.id;
    const input = e.target.querySelector(`#Parley-input-${id}`);
    const body = input.value.trim();
    if (!body || this.sending) return;

    const editing = s.editing[id];
    this.sending = true;
    const done = () => {
      this.sending = false;
      m.redraw();
      setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
    };

    if (editing) {
      delete s.editing[id];
      input.value = '';
      grow(input);
      s.edit(editing.id, body).then(done, done);
      return;
    }

    input.value = '';
    grow(input);
    s.send(id, body).then(done, (err) => {
      input.value = body;
      grow(input);
      done();
      throw err;
    });
  }

  upload(e, id) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const max = (app.parley.config.maxImageMb || 8) * 1024 * 1024;
    if (file.size > max) {
      app.alerts.show({ type: 'error' }, t('too_big', { max: app.parley.config.maxImageMb || 8 }));
      return;
    }

    this.sending = true;
    app.parley.upload(id, file).finally(() => {
      this.sending = false;
      m.redraw();
    });
  }

  reportBar(message) {
    const s = app.parley;
    const close = () => {
      s.reporting = null;
      this.reportReason = '';
    };

    return (
      <form className="pl-report" onsubmit={(e) => {
        e.preventDefault();
        api.report(message.id, this.reportReason || null).then(() => {
          close();
          app.alerts.show({ type: 'success' }, t('reported'));
          m.redraw();
        });
      }}>
        <p>{t('report_prompt')}</p>
        <input id={`Parley-report-${message.id}`} placeholder={extractText(t('report_reason'))} maxlength="500" oninput={(e) => (this.reportReason = e.target.value)} />
        <div className="pl-report-actions">
          <button type="button" onclick={close}>{t('cancel')}</button>
          <button className="danger">{t('report_send')}</button>
        </div>
      </form>
    );
  }
}
