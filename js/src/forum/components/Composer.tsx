import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import Icons from '../icons';
import api from '../api';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** Size the message box to its text, up to its CSS max-height, then scroll. */
function grow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
  // A scrollbar only once it has reached its full height: Android draws
  // one on a single line that is a pixel short otherwise.
  el.style.overflowY = el.scrollHeight > el.clientHeight + 2 ? 'auto' : 'hidden';
}

/** The @word being typed just before the caret, if any. */
function mentionAt(el) {
  const before = el.value.slice(0, el.selectionStart);
  const m2 = /(^|\s)@([\w.-]{0,30})$/.exec(before);
  return m2 ? { query: m2[2].toLowerCase(), start: before.length - m2[2].length - 1 } : null;
}

/**
 * The bottom of a conversation: "+" for photos, videos and files, emoji, the
 * message box, and — while the box is empty — a microphone for a voice note
 * and a one-tap 👍. The emoji picker and the recorder load the first time
 * they are opened, never with the page.
 */
export default class Composer extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.hasText = !!app.parley.drafts[this.attrs.conv.summary.id];
    this.plusOpen = false;
    this.emoji = null;
    this.recorder = null;
    this.mention = null;
    this.mentionIndex = 0;
  }

  view() {
    const s = app.parley;
    const conv = this.attrs.conv;
    const id = conv.summary.id;
    const editing = s.editing[id];
    const title = this.attrs.title;
    const showSend = this.hasText || editing;

    if (this.recorder) {
      const Recorder = this.recorder;
      return (
        <div className="pl-composer recording">
          <Recorder
            max={s.config.maxVoiceSeconds || 300}
            ondone={(blob, seconds) => {
              this.recorder = null;
              if (blob) s.upload(id, blobFile(blob), 'voice', { seconds: seconds.toFixed(1) });
            }}
          />
        </div>
      );
    }

    return (
      <form className="pl-composer" onsubmit={(e) => this.submit(e)}>
        {conv.uploading ? (
          <div className="pl-progress" aria-label={extractText(t('uploading'))}>
            <i style={{ width: Math.round((conv.uploading.progress || 0) * 100) + '%' }} />
          </div>
        ) : null}
        {this.mention ? this.mentionList() : null}

        <div className="pl-plus-wrap">
          <button
            type="button"
            className="pl-ib"
            aria-label={extractText(t('attach'))}
            title={extractText(t('attach'))}
            aria-expanded={String(this.plusOpen)}
            onclick={() => (this.plusOpen = !this.plusOpen)}
          >
            {Icons.plus()}
          </button>
          {this.plusOpen ? (
            <div className="pl-plus-menu Dropdown-menu">
              <button
                type="button"
                onclick={(e) => this.pick(e, 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime', 'media')}
              >
                {Icons.img()} {t('photo_or_video')}
              </button>
              <button type="button" onclick={(e) => this.pick(e, '', 'file')}>
                {Icons.file()} {t('file')}
              </button>
            </div>
          ) : null}
          <input type="file" hidden onchange={(e) => this.picked(e)} />
        </div>

        <div className="pl-input-wrap">
          {/*
            A textarea, so a message can hold line breaks: Enter sends and
            Shift+Enter starts a new line. It grows with what is typed, up to
            a few lines, then scrolls.
          */}
          <textarea
            id={`Parley-input-${id}`}
            className="FormControl"
            rows="1"
            dir="auto"
            placeholder={extractText(t('placeholder'))}
            autocomplete="off"
            aria-label={extractText(t('message_to', { name: title }))}
            oncreate={(v) => {
              v.dom.value = editing ? editing.body : s.drafts[id] || '';
              grow(v.dom);
            }}
            onupdate={(v) => {
              if (editing && v.dom.dataset.editing !== String(editing.id)) {
                v.dom.value = editing.body;
                v.dom.dataset.editing = String(editing.id);
                this.hasText = true;
              } else if (!editing && v.dom.dataset.editing) {
                v.dom.value = '';
                delete v.dom.dataset.editing;
                this.hasText = false;
              }
              grow(v.dom);
            }}
            oninput={(e) => {
              grow(e.target);
              this.hasText = e.target.value.trim() !== '';
              if (!editing) s.setDraft(id, e.target.value);
              s.typing(id);
              this.findMention(e.target);
            }}
            onkeydown={(e) => this.key(e)}
            onfocus={() => s.markRead(id)}
          />
          <button
            type="button"
            className="pl-ib pl-emoji-btn"
            aria-label={extractText(t('emoji'))}
            title={extractText(t('emoji'))}
            onclick={() => this.openEmoji()}
          >
            {Icons.emoji()}
          </button>
          {this.emoji ? (
            <this.emoji
              onpick={(char) => this.insert(char)}
              onclose={() => {
                this.emoji = null;
              }}
            />
          ) : null}
        </div>

        {showSend ? (
          <button className="pl-ib pl-send" aria-label={extractText(t('send'))} title={extractText(t('send'))}>
            {Icons.send()}
          </button>
        ) : (
          [
            typeof MediaRecorder !== 'undefined' && navigator.mediaDevices ? (
              <button
                type="button"
                className="pl-ib"
                aria-label={extractText(t('record'))}
                title={extractText(t('record'))}
                onclick={() => this.record()}
              >
                {Icons.mic()}
              </button>
            ) : null,
            <button
              type="button"
              className="pl-ib pl-like"
              aria-label={extractText(t('send_like'))}
              title={extractText(t('send_like'))}
              onclick={() => s.send(id, '👍')}
            >
              👍
            </button>,
          ]
        )}
      </form>
    );
  }

  input() {
    return document.getElementById(`Parley-input-${this.attrs.conv.summary.id}`);
  }

  key(e) {
    const s = app.parley;
    const id = this.attrs.conv.summary.id;

    if (this.mention && this.mention.list.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = this.mention.list.length;
        this.mentionIndex = (this.mentionIndex + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.complete(this.mention.list[this.mentionIndex]);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (this.mention) {
        this.mention = null;
        return;
      }
      delete s.replyTo[id];
      delete s.editing[id];
      return;
    }

    // 🚨 isComposing: with a Chinese, Japanese or Korean input method, Enter
    // CONFIRMS the character being composed. Sending on it would post
    // half-typed words.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      e.target.form?.requestSubmit();
    }
  }

  submit(e) {
    e.preventDefault();
    const s = app.parley;
    const id = this.attrs.conv.summary.id;
    const input = this.input();
    const body = input.value.trim();
    if (!body) return;

    const editing = s.editing[id];
    input.value = '';
    grow(input);
    this.hasText = false;
    this.mention = null;

    if (editing) {
      delete s.editing[id];
      s.edit(editing.id, body).catch(() => {
        input.value = body;
        this.hasText = true;
      });
    } else {
      // Queued: drawn at once, retried through a dropped connection.
      s.send(id, body);
    }
    input.focus();
  }

  pick(e, accept, kind) {
    this.plusOpen = false;
    const input = e.currentTarget.closest('.pl-plus-wrap').querySelector('input[type=file]');
    input.accept = accept;
    input.dataset.kind = kind;
    input.click();
  }

  picked(e) {
    const file = e.target.files[0];
    const kind = e.target.dataset.kind;
    e.target.value = '';
    if (!file) return;

    const s = app.parley;
    const video = /^video\//.test(file.type);
    const type = kind === 'file' ? 'file' : video ? 'video' : 'image';
    const max = type === 'image' ? s.config.maxImageMb || 8 : s.config.maxFileMb || 25;

    if (file.size > max * 1024 * 1024) {
      app.alerts.show({ type: 'error' }, t('too_big_file', { max }));
      return;
    }

    s.upload(this.attrs.conv.summary.id, file, type);
  }

  openEmoji() {
    if (this.emoji) {
      this.emoji = null;
      return;
    }
    import('./EmojiPicker').then((mod) => {
      this.emoji = mod.default;
      m.redraw();
    });
  }

  record() {
    import('./Recorder').then((mod) => {
      this.recorder = mod.default;
      m.redraw();
    });
  }

  insert(text) {
    const el = this.input();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  /** Who to suggest for an @: the group's members, or people met in a room. */
  findMention(el) {
    const s = app.parley;
    const conv = this.attrs.conv;
    const id = conv.summary.id;
    const many = conv.summary.isGroup || conv.summary.type === 'room';
    const at = many ? mentionAt(el) : null;

    if (!at) {
      this.mention = null;
      return;
    }

    if (conv.summary.isGroup && !s.members[id] && !this.fetching) {
      this.fetching = true;
      api.details(id, 'members').then((r) => {
        s.members[id] = r.members || [];
        this.findMention(el);
        m.redraw();
      });
    }

    const me = Number(s.me.id());
    const pool = conv.summary.isGroup ? s.members[id] || conv.summary.participants : [...s.cards.values()];
    const list = pool
      .filter((p) => p.id !== me && (p.username.toLowerCase().startsWith(at.query) || (p.displayName || '').toLowerCase().includes(at.query)))
      .slice(0, 6);

    this.mention = list.length ? { ...at, list } : null;
    this.mentionIndex = 0;
  }

  mentionList() {
    return (
      <ul className="pl-mentions Dropdown-menu" role="listbox">
        {this.mention.list.map((p, i) => (
          <li>
            <button
              type="button"
              role="option"
              className={i === this.mentionIndex ? 'active' : ''}
              aria-selected={String(i === this.mentionIndex)}
              onmousedown={(e) => {
                e.preventDefault();
                this.complete(p);
              }}
            >
              {Avatar(p, 22)} <b>{p.displayName}</b> <span>@{p.username}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  complete(person) {
    const el = this.input();
    if (!el || !this.mention) return;
    const caret = el.selectionStart;
    el.value = el.value.slice(0, this.mention.start) + '@' + person.username + ' ' + el.value.slice(caret);
    el.selectionStart = el.selectionEnd = this.mention.start + person.username.length + 2;
    this.mention = null;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}

/** A recording, as a file the server can sniff: its real type decides the name. */
function blobFile(blob) {
  const ext = /mp4|aac|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  return new File([blob], 'voice.' + ext, { type: blob.type || 'audio/webm' });
}
