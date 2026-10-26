import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import Icons from '../icons';
import api from '../api';
import { runPosition, clock, tally, linkParts, mentionParts } from '../util';
import { systemLine, duration, fileSize } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * The messages in one conversation, the way a chat app draws them: runs of
 * bubbles from one person with their inner corners tucked, the face and the
 * time under the last of a run, reactions tucked under the bubble, a divider
 * for each day and one where the unread starts.
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
    if (!this.jump(vnode.dom)) {
      // Open at the "New messages" line when there is one above the fold.
      const divider = vnode.dom.querySelector('.pl-new');
      if (divider && divider.offsetTop < vnode.dom.scrollHeight - vnode.dom.clientHeight) {
        vnode.dom.scrollTop = divider.offsetTop - 12;
        this.atBottom = false;
      } else {
        vnode.dom.scrollTop = vnode.dom.scrollHeight;
      }
    }
    this.firstId = this.attrs.conv.messages[0]?.id;
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    const el = vnode.dom;
    const msgs = this.attrs.conv.messages;

    if (this.jump(el)) {
      // Jumped to a search result or a pin.
    } else if (msgs[0]?.id !== this.firstId && this.heightBefore) {
      // Older messages were put on top: keep the reader where they were.
      el.scrollTop = el.scrollHeight - this.heightBefore;
      this.heightBefore = null;
    } else if (this.atBottom) {
      el.scrollTop = el.scrollHeight;
    }

    this.firstId = msgs[0]?.id;
  }

  /** Scroll to a message asked for — a search result, a pin — and light it up. */
  jump(el) {
    const conv = this.attrs.conv;
    if (!conv.jumpTo) return false;
    const target = el.querySelector(`[data-id="${conv.jumpTo}"]`);
    if (!target) return false;
    conv.jumpTo = null;
    target.scrollIntoView({ block: 'center' });
    target.classList.add('pl-lit');
    setTimeout(() => target.classList.remove('pl-lit'), 1800);
    this.atBottom = false;
    return true;
  }

  view() {
    const conv = this.attrs.conv;
    const msgs = conv.messages;
    const meId = Number(app.session.user.id());
    const peer = conv.summary.participants[0] || {};
    const isRoom = conv.summary.type === 'room';
    const many = isRoom || conv.summary.isGroup;
    const authorOf = (msg) =>
      msg.author || app.parley.card(msg.userId) || conv.summary.participants.find((p) => p.id === msg.userId) || { displayName: '?' };
    const lastMine = msgs.map((x) => (x.pending ? null : x.userId)).lastIndexOf(meId);
    const typers = Object.keys(conv.typing || {}).map(Number);
    const firstNew = msgs.findIndex((x) => !x.pending && x.userId !== meId && conv.newFrom && x.id > conv.newFrom && x.type !== 'system');

    const out = [];

    if (conv.loadingOlder) out.push(<div className="pl-day">…</div>);

    msgs.forEach((msg, i) => {
      const prev = msgs[i - 1];
      if (!prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString()) {
        out.push(
          <div className="pl-day">
            <span>{this.dayLabel(msg.createdAt)}</span>
          </div>
        );
      }

      if (i === firstNew) {
        out.push(
          <div className="pl-new">
            <span>{t('new_messages')}</span>
          </div>
        );
      }

      if (msg.type === 'call') {
        out.push(this.callRow(msg));
        return;
      }

      if (msg.type === 'system') {
        out.push(
          <div className="pl-sys" data-id={msg.id}>
            {systemLine(msg)}
          </div>
        );
        return;
      }

      const mine = msg.userId === meId;
      const who = mine ? 'me' : 'them';
      const pos = runPosition(msgs, i);
      const author = mine ? null : authorOf(msg);
      const endsRun = pos === 'last' || pos === 'single';

      // In a room or a group, the name goes over the first bubble of a run:
      // the face alone does not say who is talking.
      if (many && !mine && (pos === 'first' || pos === 'single')) {
        out.push(<div className="pl-author">{author.displayName}</div>);
      }

      if (msg.meta && msg.meta.forwarded && !msg.deleted) {
        out.push(
          <div className={'pl-forwarded ' + who}>
            {Icons.forward()} {t('forwarded')}
          </div>
        );
      }

      out.push(
        <div
          className={`pl-row ${who} ${pos === 'single' ? '' : pos} ${pos === 'first' || pos === 'single' ? 'gap' : ''}${msg.pending ? ' pending' : ''}`}
          data-id={msg.id}
          title={msg.pending ? '' : new Date(msg.createdAt).toLocaleString()}
          onpointerdown={(e) => this.press(e, msg)}
          onpointerup={() => clearTimeout(this.pressTimer)}
          onpointercancel={() => clearTimeout(this.pressTimer)}
          onpointermove={(e) => this.pressMoved(e)}
        >
          {!mine ? endsRun ? Avatar(author, 28) : <span className="pl-sp" /> : null}
          <div className="pl-stackcol">
            {this.bubble(msg)}
            {this.chips(msg, meId, who)}
          </div>
          {msg.deleted || msg.pending ? null : this.tray(msg, mine)}
        </div>
      );

      if (msg.pending) {
        out.push(this.pendingLine(msg));
      } else if (endsRun) {
        out.push(
          <div className={'pl-time ' + who}>
            {clock(msg.createdAt)}
            {msg.editedAt ? [' · ', t('edited')] : null}
          </div>
        );
      }

      if (i === lastMine) out.push(this.seen(conv, msg, peer));
    });

    if (!msgs.length) {
      out.push(
        <div className="pl-empty">
          {isRoom
            ? app.translator.trans('ernestdefoe-parley.forum.rooms.empty')
            : conv.summary.isGroup
              ? t('group_empty')
              : t('say_hello', { name: peer.displayName })}
        </div>
      );
    }

    if (conv.gapAfter) {
      out.push(
        <button className="Button pl-latest" onclick={() => app.parley.load(conv.summary.id)}>
          {t('jump_to_latest')}
        </button>
      );
    }

    typers.forEach((uid) => {
      const p = conv.summary.participants.find((x) => x.id === uid) || app.parley.card(uid);
      if (p)
        out.push(
          <div className="pl-typing" aria-label={extractText(t('typing', { name: p.displayName }))}>
            {Avatar(p, 28)}
            <div className="pl-bub">
              <i />
              <i />
              <i />
            </div>
          </div>
        );
    });

    return (
      <div className="pl-w-body" onscroll={(e) => this.scrolled(e)} aria-live="polite">
        {out}
      </div>
    );
  }

  /**
   * On a touch screen the tray opens with a long press, as in a phone's own
   * messenger: there is no hover, and iOS spends a first tap on hover, so a
   * tray shown on hover would swallow the tap meant for Play or a link.
   */
  press(e, msg) {
    e.redraw = false;
    if (e.pointerType !== 'touch' || msg.deleted || msg.pending) return;
    this.pressAt = [e.clientX, e.clientY];
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.trayFor = msg.id;
      this.menuFor = null;
      navigator.vibrate?.(10);
      m.redraw();
      const away = (ev) => {
        if (ev.target.closest && ev.target.closest('.pl-react-tray')) return;
        this.trayFor = null;
        this.menuFor = null;
        document.removeEventListener('pointerdown', away, true);
        m.redraw();
      };
      document.addEventListener('pointerdown', away, true);
    }, 450);
  }

  pressMoved(e) {
    e.redraw = false;
    if (!this.pressAt) return;
    if (Math.abs(e.clientX - this.pressAt[0]) + Math.abs(e.clientY - this.pressAt[1]) > 10) clearTimeout(this.pressTimer);
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

  /** Who has read up to your last message: their faces, small, under it. */
  seen(conv, msg, peer) {
    const meId = Number(app.session.user.id());
    const readers = Object.entries(conv.summary.seenBy || {})
      .filter(([uid, read]) => Number(uid) !== meId && (read || 0) >= msg.id)
      .map(([uid]) => conv.summary.participants.find((p) => p.id === Number(uid)) || app.parley.card(uid))
      .filter(Boolean);

    if (conv.summary.type === 'room' || !readers.length) return null;

    // In a one-to-one, only once they have read the very last message.
    if (!conv.summary.isGroup && msg.id !== Math.max(...conv.messages.filter((x) => !x.pending).map((x) => x.id))) return null;

    const names = readers.map((p) => p.displayName).join(', ');
    return (
      <div className="pl-seen" title={extractText(t('seen_by', { names }))} aria-label={extractText(t('seen_by', { names }))}>
        {(conv.summary.isGroup ? readers.slice(0, 5) : [peer]).map((p) => Avatar(p, 14))}
        {readers.length > 5 ? <span className="pl-seen-more">+{readers.length - 5}</span> : null}
      </div>
    );
  }

  pendingLine(msg) {
    const s = app.parley;
    if (msg.failed) {
      return (
        <div className="pl-time me failed">
          {msg.error || t('not_sent')}
          {' · '}
          <button className="Button Button--link" onclick={() => s.retry(msg.nonce)}>
            {t('retry')}
          </button>
          {' · '}
          <button className="Button Button--link" onclick={() => s.discard(msg.nonce)}>
            {t('delete')}
          </button>
        </div>
      );
    }
    return <div className="pl-time me">{msg.waiting ? t('waiting_for_connection') : t('sending')}</div>;
  }

  chips(msg, meId, who) {
    const chips = tally(msg.reactions);
    if (!chips.length) return null;
    return (
      <div className={'pl-chips ' + who}>
        {chips.map(([emoji, n]) => (
          <button
            className={'pl-chip' + (msg.reactions.some((r) => r.userId === meId && r.emoji === emoji) ? ' mine' : '')}
            onclick={() => app.parley.react(msg.id, emoji)}
            aria-label={extractText(t('reaction_count', { emoji, count: n }))}
          >
            {emoji}
            {n > 1 ? <span>{n}</span> : null}
          </button>
        ))}
      </div>
    );
  }

  bubble(msg) {
    if (msg.deleted) return <div className="pl-bub deleted">{t('deleted')}</div>;

    const quote = msg.replyTo ? (
      <div className="pl-quote">
        {msg.replyTo.authorName ? <b>{msg.replyTo.authorName}</b> : null}
        <span>{msg.replyTo.excerpt ?? extractText(msg.replyTo.type === 'text' ? t('deleted') : t('attachment'))}</span>
      </div>
    ) : null;
    const pin = msg.pinned ? (
      <span className="pl-pinmark" title={extractText(t('pinned'))}>
        {Icons.pin()}
      </span>
    ) : null;
    const meta = msg.meta || {};
    const src = api.fileUrl(msg.id);

    if (msg.type === 'image') {
      const w = Math.min(240, meta.w || 240);
      const h = meta.w ? Math.round((w / meta.w) * meta.h) : 160;
      return (
        <div className="pl-bub pl-media">
          {quote}
          {pin}
          <a href={src} target="_blank" rel="noopener">
            <img src={src} width={w} height={h} alt={extractText(t('photo'))} loading="lazy" />
          </a>
        </div>
      );
    }

    if (msg.type === 'video') {
      return (
        <div className="pl-bub pl-media">
          {quote}
          {pin}
          <video src={src} controls preload="metadata" playsinline width="240" />
        </div>
      );
    }

    if (msg.type === 'voice') {
      return (
        <div className="pl-bub pl-voice">
          {pin}
          <VoicePlayer src={src} seconds={meta.duration} />
        </div>
      );
    }

    if (msg.type === 'file') {
      return (
        <div className="pl-bub pl-file">
          {quote}
          {pin}
          <a href={src} download={meta.name || ''} rel="noopener">
            <span className="pl-file-icon">{Icons.file()}</span>
            <span className="pl-file-info">
              <span className="pl-file-name">{meta.name || extractText(t('file'))}</span>
              <span className="pl-file-size">{fileSize(meta.size)}</span>
            </span>
          </a>
        </div>
      );
    }

    // A single emoji, or two or three, read better big and without a bubble.
    const big = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍){1,8}$/u.test((msg.body || '').trim()) && !quote;

    return (
      <div className={'pl-bub' + (big ? ' pl-big' : '')}>
        {quote}
        {pin}
        {linkParts(msg.body || '').map((part) =>
          typeof part === 'string' ? (
            mentionParts(part).map((bit) => (typeof bit === 'string' ? bit : <b className="pl-mention">@{bit.username}</b>))
          ) : (
            <a href={part.url} target="_blank" rel="nofollow ugc noopener">
              {part.url}
            </a>
          )
        )}
      </div>
    );
  }

  tray(msg, mine) {
    const s = app.parley;
    const conv = this.attrs.conv;
    const menuOpen = this.menuFor === msg.id;

    return (
      <div className={'pl-react-tray' + (menuOpen || this.trayFor === msg.id ? ' open' : '')} role="group" aria-label={extractText(t('react'))}>
        {(s.config.reactions || []).map((e) => (
          <button
            aria-label={e}
            onclick={() => {
              s.react(msg.id, e);
              this.trayFor = null;
            }}
          >
            {e}
          </button>
        ))}
        <button
          className="pl-rp"
          aria-label={extractText(t('reply'))}
          title={extractText(t('reply'))}
          onclick={() => {
            s.replyTo[conv.summary.id] = msg;
            document.getElementById(`Parley-input-${conv.summary.id}`)?.focus();
          }}
        >
          {Icons.reply()}
        </button>
        <button
          className="pl-rp pl-more"
          aria-label={extractText(t('more'))}
          aria-expanded={String(menuOpen)}
          onclick={() => {
            this.menuFor = menuOpen ? null : msg.id;
            this.confirmDelete = null;
          }}
        >
          {Icons.more()}
        </button>
        {menuOpen ? this.menu(msg, mine) : null}
      </div>
    );
  }

  menu(msg, mine) {
    const s = app.parley;
    const conv = this.attrs.conv;
    const id = conv.summary.id;
    const isRoom = conv.summary.type === 'room';
    const done = () => {
      this.menuFor = null;
      this.confirmDelete = null;
    };

    if (this.confirmDelete === msg.id) {
      return (
        <div className="pl-msg-menu Dropdown-menu">
          <button className="danger" onclick={() => s.remove(msg.id).then(done)}>
            {t('delete_for_everyone')}
          </button>
          <button onclick={done}>{t('cancel')}</button>
        </div>
      );
    }

    const canPin = !isRoom || s.config.canModerate;

    return (
      <div className="pl-msg-menu Dropdown-menu">
        {msg.type === 'text' ? (
          <button
            onclick={() => {
              navigator.clipboard?.writeText(msg.body || '').catch(() => {});
              done();
            }}
          >
            {t('copy')}
          </button>
        ) : null}
        {mine && msg.type === 'text' ? (
          <button
            onclick={() => {
              s.editing[id] = msg;
              done();
              setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
            }}
          >
            {t('edit')}
          </button>
        ) : null}
        {canPin ? (
          <button
            onclick={() => {
              s.pin(msg.id, !msg.pinned);
              done();
            }}
          >
            {msg.pinned ? t('unpin') : t('pin')}
          </button>
        ) : null}
        <button
          onclick={() => {
            done();
            app.modal.show(() => import('./ForwardModal'), { message: msg });
          }}
        >
          {t('forward')}
        </button>
        {mine || (isRoom && s.config.canModerate) ? (
          <button className="danger" onclick={() => (this.confirmDelete = msg.id)}>
            {t('delete')}
          </button>
        ) : null}
        {!mine ? (
          <button
            className="danger"
            onclick={() => {
              s.reporting = { conversationId: id, message: msg };
              done();
            }}
          >
            {t('report')}
          </button>
        ) : null}
      </div>
    );
  }

  /**
   * "Video call · 4:12", "Missed call" — written by Parley Calls, drawn here
   * so the history still reads if Calls is ever removed.
   *
   * One row serves both people, so it reads from where you sit: a call that
   * was not picked up is "not answered" to the caller and "Missed call" to the
   * person who was called.
   */
  callRow(msg) {
    const meta = msg.meta || {};
    const video = meta.kind === 'video';
    const d = meta.durationSeconds;
    const length = d ? duration(d) : null;
    const iCalled = (meta.callerId || msg.userId) === Number(app.session.user.id());
    const answered = meta.outcome === 'completed';

    const text = answered
      ? [t(video ? 'call_video' : 'call_voice'), length ? ' · ' + length : '']
      : iCalled
        ? t(
            meta.outcome === 'declined'
              ? video
                ? 'call_video_declined'
                : 'call_voice_declined'
              : video
                ? 'call_video_unanswered'
                : 'call_voice_unanswered'
          )
        : t('call_missed');

    return (
      <div className={'pl-sys pl-call' + (!answered && !iCalled ? ' missed' : '')} data-id={msg.id}>
        {video ? Icons.video() : Icons.phone()}
        <span>{text}</span>
        <span>{clock(msg.createdAt)}</span>
      </div>
    );
  }

  dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return extractText(t('today'));
    if (d.toDateString() === yesterday.toDateString()) return extractText(t('yesterday'));
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
  }
}

/**
 * A voice note: play, a bar that fills as it plays (click to jump), and the
 * time. The audio is fetched only when play is pressed.
 */
class VoicePlayer extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.playing = false;
    this.at = 0;
  }

  view() {
    const total = Number(this.attrs.seconds) || 0;
    const left = this.playing || this.at ? Math.max(0, total - this.at) : total;

    return (
      <div className="pl-voice-player">
        <button className="pl-play" aria-label={extractText(t(this.playing ? 'pause' : 'play'))} onclick={() => this.toggle()}>
          {this.playing ? Icons.pause() : Icons.play()}
        </button>
        <span
          className="pl-wave"
          role="slider"
          aria-valuemin="0"
          aria-valuemax={String(Math.round(total))}
          aria-valuenow={String(Math.round(this.at))}
          onclick={(e) => this.seek(e)}
        >
          <i style={{ width: (total ? Math.min(100, (this.at / total) * 100) : 0) + '%' }} />
        </span>
        <span className="pl-voice-time">{duration(left)}</span>
      </div>
    );
  }

  audio() {
    if (!this.el) {
      this.el = new Audio(this.attrs.src);
      this.el.addEventListener('timeupdate', () => {
        this.at = this.el.currentTime;
        m.redraw();
      });
      this.el.addEventListener('ended', () => {
        this.playing = false;
        this.at = 0;
        m.redraw();
      });
    }
    return this.el;
  }

  toggle() {
    const a = this.audio();
    if (this.playing) {
      a.pause();
      this.playing = false;
    } else {
      // One voice note at a time across the page.
      if (VoicePlayer.current && VoicePlayer.current !== this) VoicePlayer.current.stop();
      VoicePlayer.current = this;
      a.play().catch(() => (this.playing = false));
      this.playing = true;
    }
  }

  stop() {
    if (this.el) this.el.pause();
    this.playing = false;
    m.redraw();
  }

  seek(e) {
    const total = Number(this.attrs.seconds) || 0;
    const r = e.currentTarget.getBoundingClientRect();
    const a = this.audio();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total;
    this.at = a.currentTime;
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (this.el) this.el.pause();
  }
}
