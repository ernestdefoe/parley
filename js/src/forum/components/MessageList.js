import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import Icons from '../icons';
import api from '../api';
import { runPosition, needsDivider, clock, tally, linkParts } from '../util';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * The messages in one conversation, drawn the mockup's way: runs of bubbles
 * from one person with their inner corners tucked, the avatar on the last of a
 * run, a reaction tray on hover, the "seen" face under your last message.
 */
export default class MessageList extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.atBottom = true;
    this.menuFor = null;
    this.confirmDelete = null;
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    vnode.dom.scrollTop = vnode.dom.scrollHeight;
    this.lastCount = this.attrs.conv.messages.length;
    this.firstId = this.attrs.conv.messages[0]?.id;
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    const el = vnode.dom;
    const msgs = this.attrs.conv.messages;

    // Older messages were put on top: keep the reader where they were.
    if (msgs[0]?.id !== this.firstId && this.heightBefore) {
      el.scrollTop = el.scrollHeight - this.heightBefore;
      this.heightBefore = null;
    } else if (this.atBottom) {
      el.scrollTop = el.scrollHeight;
    }

    this.firstId = msgs[0]?.id;
    this.lastCount = msgs.length;
  }

  view() {
    const conv = this.attrs.conv;
    const msgs = conv.messages;
    const meId = Number(app.session.user.id());
    const peer = conv.summary.participants[0] || {};
    const lastMine = msgs.map((x) => x.userId).lastIndexOf(meId);
    const seenId = Math.max(0, ...Object.values(conv.summary.seenBy || {}).map((v) => v || 0));
    const typers = Object.keys(conv.typing || {}).map(Number);

    const out = [];

    if (conv.loadingOlder) out.push(<div className="pl-day">…</div>);

    msgs.forEach((msg, i) => {
      if (needsDivider(msgs, i)) {
        const newDay = i === 0 || new Date(msgs[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
        out.push(<div className="pl-day">{newDay ? this.dayLabel(msg.createdAt) : clock(msg.createdAt)}</div>);
      }

      if (msg.type === 'call') {
        out.push(this.callRow(msg));
        return;
      }

      const mine = msg.userId === meId;
      const who = mine ? 'me' : 'them';
      const pos = runPosition(msgs, i);
      const author = mine ? null : conv.summary.participants.find((p) => p.id === msg.userId) || { displayName: '?' };
      const showFace = !mine && (pos === 'last' || pos === 'single');

      out.push(
        <div className={`pl-row ${who} ${pos === 'single' ? '' : pos} ${pos === 'first' || pos === 'single' ? 'gap' : ''}`} title={clock(msg.createdAt)}>
          {!mine ? (showFace ? Avatar(author, 26) : <span className="pl-sp" />) : null}
          {this.bubble(msg)}
          {msg.deleted ? null : this.tray(msg, mine)}
        </div>
      );

      const chips = tally(msg.reactions);
      if (chips.length) {
        out.push(
          <div className={'pl-chips ' + who}>
            {chips.map(([emoji, n]) => (
              <button className={'pl-chip' + (msg.reactions.some((r) => r.userId === meId && r.emoji === emoji) ? ' mine' : '')} onclick={() => app.parley.react(msg.id, emoji)}>
                {emoji} {n}
              </button>
            ))}
          </div>
        );
      }

      if (i === lastMine && i === msgs.length - 1 && !conv.summary.isGroup && seenId >= msg.id) {
        out.push(<div className="pl-seen" title={extractText(t('seen'))}>{Avatar(peer, 14)}</div>);
      }
    });

    if (!msgs.length) out.push(<div className="pl-empty">{t('say_hello', { name: peer.displayName })}</div>);

    typers.forEach((uid) => {
      const p = conv.summary.participants.find((x) => x.id === uid);
      if (p)
        out.push(
          <div className="pl-typing" aria-label={extractText(t('typing', { name: p.displayName }))}>
            {Avatar(p, 26)}
            <div className="pl-bub"><i /><i /><i /></div>
          </div>
        );
    });

    return (
      <div className="pl-w-body" onscroll={(e) => this.scrolled(e)} aria-live="polite">
        {out}
      </div>
    );
  }

  scrolled(e) {
    const el = e.target;
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 60 && this.attrs.conv.hasOlder && !this.attrs.conv.loadingOlder) {
      this.heightBefore = el.scrollHeight;
      app.parley.older(this.attrs.conv.summary.id);
    }
    e.redraw = false;
  }

  bubble(msg) {
    if (msg.deleted) return <div className="pl-bub deleted">{t('deleted')}</div>;

    const quote = msg.replyTo ? (
      <div className="pl-quote">{msg.replyTo.excerpt ?? extractText(msg.replyTo.type === 'image' ? t('photo') : t('deleted'))}</div>
    ) : null;

    if (msg.type === 'image') {
      const src = api.imageUrl(msg.id);
      const meta = msg.meta || {};
      const w = Math.min(220, meta.w || 220);
      const h = meta.w ? Math.round((w / meta.w) * meta.h) : 160;
      return (
        <div className="pl-bub pl-photo">
          {quote}
          <a href={src} target="_blank" rel="noopener">
            <img src={src} width={w} height={h} alt={extractText(t('photo'))} loading="lazy" />
          </a>
        </div>
      );
    }

    return (
      <div className="pl-bub">
        {quote}
        {linkParts(msg.body || '').map((part) =>
          typeof part === 'string' ? part : <a href={part.url} target="_blank" rel="nofollow ugc noopener">{part.url}</a>
        )}
        {msg.editedAt ? <span className="pl-edited"> {t('edited')}</span> : null}
      </div>
    );
  }

  tray(msg, mine) {
    const s = app.parley;
    const conv = this.attrs.conv;
    const menuOpen = this.menuFor === msg.id;

    return (
      <div className={'pl-react-tray' + (menuOpen ? ' open' : '')} role="group" aria-label={extractText(t('react'))}>
        {(s.config.reactions || []).map((e) => (
          <button aria-label={e} onclick={() => s.react(msg.id, e)}>{e}</button>
        ))}
        <button className="pl-rp" onclick={() => {
          s.replyTo[conv.summary.id] = msg;
          document.getElementById(`Parley-input-${conv.summary.id}`)?.focus();
        }}>{t('reply')}</button>
        <button className="pl-rp pl-more" aria-label={extractText(t('more'))} aria-expanded={String(menuOpen)} onclick={() => {
          this.menuFor = menuOpen ? null : msg.id;
          this.confirmDelete = null;
        }}>{Icons.more()}</button>
        {menuOpen ? this.menu(msg, mine) : null}
      </div>
    );
  }

  menu(msg, mine) {
    const s = app.parley;
    const id = this.attrs.conv.summary.id;
    const done = () => {
      this.menuFor = null;
      this.confirmDelete = null;
    };

    if (this.confirmDelete === msg.id) {
      return (
        <div className="pl-msg-menu">
          <button className="danger" onclick={() => s.remove(msg.id).then(done)}>{t('delete_for_everyone')}</button>
          <button onclick={done}>{t('cancel')}</button>
        </div>
      );
    }

    return (
      <div className="pl-msg-menu">
        {msg.type === 'text' ? <button onclick={() => {
          navigator.clipboard?.writeText(msg.body || '').catch(() => {});
          done();
        }}>{t('copy')}</button> : null}
        {mine && msg.type === 'text' ? <button onclick={() => {
          s.editing[id] = msg;
          done();
          setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
        }}>{t('edit')}</button> : null}
        {mine ? <button className="danger" onclick={() => (this.confirmDelete = msg.id)}>{t('delete')}</button> : null}
        {!mine ? <button className="danger" onclick={() => {
          s.reporting = { conversationId: id, message: msg };
          done();
        }}>{t('report')}</button> : null}
      </div>
    );
  }

  /** "Video call · 4:12", "Missed call" — written by Parley Calls, drawn here
   *  so the history still reads if Calls is ever removed. */
  callRow(msg) {
    const meta = msg.meta || {};
    const video = meta.kind === 'video';
    const d = meta.durationSeconds;
    const length = d ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` : null;
    const text = meta.outcome === 'missed'
      ? t('call_missed')
      : meta.outcome === 'unanswered'
        ? t(video ? 'call_video_unanswered' : 'call_voice_unanswered')
        : [t(video ? 'call_video' : 'call_voice'), length ? ' · ' + length : ''];

    return (
      <div className="pl-sys">
        {video ? Icons.video() : Icons.phone()}
        <span>{text}</span>
        <span className="pl-mono">{clock(msg.createdAt)}</span>
      </div>
    );
  }

  dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const day = d.toDateString() === today.toDateString()
      ? extractText(t('today'))
      : d.toDateString() === yesterday.toDateString()
        ? extractText(t('yesterday'))
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return day;
  }
}
