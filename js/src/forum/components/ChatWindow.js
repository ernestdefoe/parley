import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import MessageList from './MessageList';
import Icons from '../icons';
import api from '../api';
import { presenceLine } from './activity';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * A docked conversation: header, messages, composer. The same component fills
 * the screen on a phone and the right-hand pane of the inbox page.
 */
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

    const peer = conv.summary.participants[0] || { displayName: '?' };
    const live = { ...peer, ...s.presenceOf(peer.id) };
    const title = conv.summary.isGroup ? conv.summary.title || conv.summary.participants.map((p) => p.displayName).join(', ') : peer.displayName;
    const replying = s.replyTo[id];
    const editing = s.editing[id];
    const reporting = s.reporting && s.reporting.conversationId === id ? s.reporting.message : null;

    return (
      <section className={'pl-win' + (min ? ' min' : '') + (s.flash.has(id) ? ' flash' : '') + (this.attrs.page ? ' page' : '')} aria-label={extractText(t('label', { name: title }))}>
        <div className="pl-w-head">
          {Avatar(live, 32, { dot: true })}
          <div className="pl-who" onclick={() => !this.attrs.page && s.toggleMinimised(id)}>
            <div className="pl-nm">{title}</div>
            <div className="pl-st">{presenceLine(live)}</div>
          </div>
          {this.headerItems(conv, live).toArray()}
        </div>

        <MessageList key={'list-' + id} conv={conv} />

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

        <form className="pl-composer" onsubmit={(e) => this.submit(e, conv)}>
          <button type="button" className="pl-ib" title={extractText(t('add_photo'))} aria-label={extractText(t('add_photo'))} onclick={(e) => e.currentTarget.nextElementSibling.click()}>
            {Icons.img()}
          </button>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onchange={(e) => this.upload(e, id)} />
          <input
            id={`Parley-input-${id}`}
            placeholder="Aa"
            autocomplete="off"
            aria-label={extractText(t('message_to', { name: title }))}
            oncreate={(v) => editing && (v.dom.value = editing.body)}
            onupdate={(v) => {
              if (editing && v.dom.dataset.editing !== String(editing.id)) {
                v.dom.value = editing.body;
                v.dom.dataset.editing = String(editing.id);
              } else if (!editing && v.dom.dataset.editing) {
                v.dom.value = '';
                delete v.dom.dataset.editing;
              }
            }}
            oninput={() => s.typing(id)}
            onkeydown={(e) => {
              if (e.key === 'Escape') {
                delete s.replyTo[id];
                delete s.editing[id];
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

    if (this.attrs.page) return items;

    items.add('minimise', (
      <button className="pl-ib plain" aria-label={extractText(t('minimise'))} title={extractText(t('minimise'))} onclick={() => s.toHead(id)}>{Icons.min()}</button>
    ), -10);
    items.add('close', (
      <button className="pl-ib plain" aria-label={extractText(t('close'))} title={extractText(t('close'))} onclick={() => s.close(id)}>{Icons.x()}</button>
    ), -20);

    return items;
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
      s.edit(editing.id, body).then(done, done);
      return;
    }

    input.value = '';
    s.send(id, body).then(done, (err) => {
      input.value = body;
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
