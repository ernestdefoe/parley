"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/ChatBody"],{

/***/ "./src/forum/components/ChatBody.js"
/*!******************************************!*\
  !*** ./src/forum/components/ChatBody.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Composer: () => (/* reexport safe */ _Composer__WEBPACK_IMPORTED_MODULE_1__["default"]),
/* harmony export */   MessageList: () => (/* reexport safe */ _MessageList__WEBPACK_IMPORTED_MODULE_0__["default"])
/* harmony export */ });
/* harmony import */ var _MessageList__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./MessageList */ "./src/forum/components/MessageList.js");
/* harmony import */ var _Composer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Composer */ "./src/forum/components/Composer.js");
/*
 * What a conversation window draws inside it: the messages and the composer.
 * One chunk, loaded when the first window or the messages page opens, so a
 * page with only chat heads on it carries none of it.
 */



flarum.reg.add('ernestdefoe-parley', 'forum/components/ChatBody', { MessageList: _MessageList__WEBPACK_IMPORTED_MODULE_0__["default"],Composer: _Composer__WEBPACK_IMPORTED_MODULE_1__["default"], });

/***/ },

/***/ "./src/forum/components/Composer.js"
/*!******************************************!*\
  !*** ./src/forum/components/Composer.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Composer)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");






const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** Size the message box to its text, up to its CSS max-height, then scroll. */
function grow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** The @word being typed just before the caret, if any. */
function mentionAt(el) {
  const before = el.value.slice(0, el.selectionStart);
  const m2 = /(^|\s)@([\w.-]{0,30})$/.exec(before);
  return m2 ? {
    query: m2[2].toLowerCase(),
    start: before.length - m2[2].length - 1
  } : null;
}

/**
 * The bottom of a conversation: "+" for photos, videos and files, emoji, the
 * message box, and — while the box is empty — a microphone for a voice note
 * and a one-tap 👍. The emoji picker and the recorder load the first time
 * they are opened, never with the page.
 */
class Composer extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.hasText = !!(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).drafts[this.attrs.conv.summary.id];
    this.plusOpen = false;
    this.emoji = null;
    this.recorder = null;
    this.mention = null;
    this.mentionIndex = 0;
  }
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const conv = this.attrs.conv;
    const id = conv.summary.id;
    const editing = s.editing[id];
    const title = this.attrs.title;
    const showSend = this.hasText || editing;
    if (this.recorder) {
      const Recorder = this.recorder;
      return m("div", {
        className: "pl-composer recording"
      }, m(Recorder, {
        max: s.config.maxVoiceSeconds || 300,
        ondone: (blob, seconds) => {
          this.recorder = null;
          if (blob) s.upload(id, blobFile(blob), 'voice', {
            seconds: seconds.toFixed(1)
          });
        }
      }));
    }
    return m("form", {
      className: "pl-composer",
      onsubmit: e => this.submit(e)
    }, conv.uploading ? m("div", {
      className: "pl-progress",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('uploading'))
    }, m("i", {
      style: {
        width: Math.round((conv.uploading.progress || 0) * 100) + '%'
      }
    })) : null, this.mention ? this.mentionList() : null, m("div", {
      className: "pl-plus-wrap"
    }, m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('attach')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('attach')),
      "aria-expanded": String(this.plusOpen),
      onclick: () => this.plusOpen = !this.plusOpen
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].plus()), this.plusOpen ? m("div", {
      className: "pl-plus-menu Dropdown-menu"
    }, m("button", {
      type: "button",
      onclick: e => this.pick(e, 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime', 'media')
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].img(), " ", t('photo_or_video')), m("button", {
      type: "button",
      onclick: e => this.pick(e, '', 'file')
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].file(), " ", t('file'))) : null, m("input", {
      type: "file",
      hidden: true,
      onchange: e => this.picked(e)
    })), m("div", {
      className: "pl-input-wrap"
    }, m("textarea", {
      id: `Parley-input-${id}`,
      className: "FormControl",
      rows: "1",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('placeholder')),
      autocomplete: "off",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('message_to', {
        name: title
      })),
      oncreate: v => {
        v.dom.value = editing ? editing.body : s.drafts[id] || '';
        grow(v.dom);
      },
      onupdate: v => {
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
      },
      oninput: e => {
        grow(e.target);
        this.hasText = e.target.value.trim() !== '';
        if (!editing) s.setDraft(id, e.target.value);
        s.typing(id);
        this.findMention(e.target);
      },
      onkeydown: e => this.key(e),
      onfocus: () => s.markRead(id)
    }), m("button", {
      type: "button",
      className: "pl-ib pl-emoji-btn",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('emoji')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('emoji')),
      onclick: () => this.openEmoji()
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].emoji()), this.emoji ? m(this.emoji, {
      onpick: char => this.insert(char),
      onclose: () => {
        this.emoji = null;
      }
    }) : null), showSend ? m("button", {
      className: "pl-ib pl-send",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send'))
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].send()) : [typeof MediaRecorder !== 'undefined' && navigator.mediaDevices ? m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('record')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('record')),
      onclick: () => this.record()
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].mic()) : null, m("button", {
      type: "button",
      className: "pl-ib pl-like",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send_like')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send_like')),
      onclick: () => s.send(id, '👍')
    }, "\uD83D\uDC4D")]);
  }
  input() {
    return document.getElementById(`Parley-input-${this.attrs.conv.summary.id}`);
  }
  key(e) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
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
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
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
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const video = /^video\//.test(file.type);
    const type = kind === 'file' ? 'file' : video ? 'video' : 'image';
    const max = type === 'image' ? s.config.maxImageMb || 8 : s.config.maxFileMb || 25;
    if (file.size > max * 1024 * 1024) {
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
        type: 'error'
      }, t('too_big_file', {
        max
      }));
      return;
    }
    s.upload(this.attrs.conv.summary.id, file, type);
  }
  openEmoji() {
    if (this.emoji) {
      this.emoji = null;
      return;
    }
    __webpack_require__.e(/*! import() | forum/components/EmojiPicker */ "ernestdefoe-parley:forum/components/EmojiPicker").then(() => (__webpack_require__(/*! ./EmojiPicker */ "./src/forum/components/EmojiPicker.js"))).then(mod => {
      this.emoji = mod.default;
      m.redraw();
    });
  }
  record() {
    __webpack_require__.e(/*! import() | forum/components/Recorder */ "ernestdefoe-parley:forum/components/Recorder").then(() => (__webpack_require__(/*! ./Recorder */ "./src/forum/components/Recorder.js"))).then(mod => {
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
    el.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    el.focus();
  }

  /** Who to suggest for an @: the group's members, or people met in a room. */
  findMention(el) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
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
      _api__WEBPACK_IMPORTED_MODULE_5__["default"].details(id, 'members').then(r => {
        s.members[id] = r.members || [];
        this.findMention(el);
        m.redraw();
      });
    }
    const me = Number(s.me.id());
    const pool = conv.summary.isGroup ? s.members[id] || conv.summary.participants : [...s.cards.values()];
    const list = pool.filter(p => p.id !== me && (p.username.toLowerCase().startsWith(at.query) || (p.displayName || '').toLowerCase().includes(at.query))).slice(0, 6);
    this.mention = list.length ? {
      ...at,
      list
    } : null;
    this.mentionIndex = 0;
  }
  mentionList() {
    return m("ul", {
      className: "pl-mentions Dropdown-menu",
      role: "listbox"
    }, this.mention.list.map((p, i) => m("li", null, m("button", {
      type: "button",
      role: "option",
      className: i === this.mentionIndex ? 'active' : '',
      "aria-selected": String(i === this.mentionIndex),
      onmousedown: e => {
        e.preventDefault();
        this.complete(p);
      }
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__["default"])(p, 22), " ", m("b", null, p.displayName), " ", m("span", null, "@", p.username)))));
  }
  complete(person) {
    const el = this.input();
    if (!el || !this.mention) return;
    const caret = el.selectionStart;
    el.value = el.value.slice(0, this.mention.start) + '@' + person.username + ' ' + el.value.slice(caret);
    el.selectionStart = el.selectionEnd = this.mention.start + person.username.length + 2;
    this.mention = null;
    el.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    el.focus();
  }
}

/** A recording, as a file the server can sniff: its real type decides the name. */
function blobFile(blob) {
  const ext = /mp4|aac|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  return new File([blob], 'voice.' + ext, {
    type: blob.type || 'audio/webm'
  });
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Composer', Composer);flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/EmojiPicker', './src/forum/components/EmojiPicker.js', 'ernestdefoe-parley', 'forum/components/EmojiPicker');
flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/Recorder', './src/forum/components/Recorder.js', 'ernestdefoe-parley', 'forum/components/Recorder');

/***/ },

/***/ "./src/forum/components/MessageList.js"
/*!*********************************************!*\
  !*** ./src/forum/components/MessageList.js ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MessageList)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../util */ "./src/forum/util.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");








const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * The messages in one conversation, the way a chat app draws them: runs of
 * bubbles from one person with their inner corners tucked, the face and the
 * time under the last of a run, reactions tucked under the bubble, a divider
 * for each day and one where the unread starts.
 */
class MessageList extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
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
    target.scrollIntoView({
      block: 'center'
    });
    target.classList.add('pl-lit');
    setTimeout(() => target.classList.remove('pl-lit'), 1800);
    this.atBottom = false;
    return true;
  }
  view() {
    const conv = this.attrs.conv;
    const msgs = conv.messages;
    const meId = Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id());
    const peer = conv.summary.participants[0] || {};
    const isRoom = conv.summary.type === 'room';
    const many = isRoom || conv.summary.isGroup;
    const authorOf = msg => msg.author || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.card(msg.userId) || conv.summary.participants.find(p => p.id === msg.userId) || {
      displayName: '?'
    };
    const lastMine = msgs.map(x => x.pending ? null : x.userId).lastIndexOf(meId);
    const typers = Object.keys(conv.typing || {}).map(Number);
    const firstNew = msgs.findIndex(x => !x.pending && x.userId !== meId && conv.newFrom && x.id > conv.newFrom && x.type !== 'system');
    const out = [];
    if (conv.loadingOlder) out.push(m("div", {
      className: "pl-day"
    }, "\u2026"));
    msgs.forEach((msg, i) => {
      const prev = msgs[i - 1];
      if (!prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString()) {
        out.push(m("div", {
          className: "pl-day"
        }, m("span", null, this.dayLabel(msg.createdAt))));
      }
      if (i === firstNew) {
        out.push(m("div", {
          className: "pl-new"
        }, m("span", null, t('new_messages'))));
      }
      if (msg.type === 'call') {
        out.push(this.callRow(msg));
        return;
      }
      if (msg.type === 'system') {
        out.push(m("div", {
          className: "pl-sys",
          "data-id": msg.id
        }, (0,_labels__WEBPACK_IMPORTED_MODULE_7__.systemLine)(msg)));
        return;
      }
      const mine = msg.userId === meId;
      const who = mine ? 'me' : 'them';
      const pos = (0,_util__WEBPACK_IMPORTED_MODULE_6__.runPosition)(msgs, i);
      const author = mine ? null : authorOf(msg);
      const endsRun = pos === 'last' || pos === 'single';

      // In a room or a group, the name goes over the first bubble of a run:
      // the face alone does not say who is talking.
      if (many && !mine && (pos === 'first' || pos === 'single')) {
        out.push(m("div", {
          className: "pl-author"
        }, author.displayName));
      }
      if (msg.meta && msg.meta.forwarded && !msg.deleted) {
        out.push(m("div", {
          className: 'pl-forwarded ' + who
        }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].forward(), " ", t('forwarded')));
      }
      out.push(m("div", {
        className: `pl-row ${who} ${pos === 'single' ? '' : pos} ${pos === 'first' || pos === 'single' ? 'gap' : ''}${msg.pending ? ' pending' : ''}`,
        "data-id": msg.id,
        title: msg.pending ? '' : new Date(msg.createdAt).toLocaleString()
      }, !mine ? endsRun ? (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__["default"])(author, 28) : m("span", {
        className: "pl-sp"
      }) : null, m("div", {
        className: "pl-stackcol"
      }, this.bubble(msg), this.chips(msg, meId, who)), msg.deleted || msg.pending ? null : this.tray(msg, mine)));
      if (msg.pending) {
        out.push(this.pendingLine(msg));
      } else if (endsRun) {
        out.push(m("div", {
          className: 'pl-time ' + who
        }, (0,_util__WEBPACK_IMPORTED_MODULE_6__.clock)(msg.createdAt), msg.editedAt ? [' · ', t('edited')] : null));
      }
      if (i === lastMine) out.push(this.seen(conv, msg, peer));
    });
    if (!msgs.length) {
      out.push(m("div", {
        className: "pl-empty"
      }, isRoom ? flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.empty') : conv.summary.isGroup ? t('group_empty') : t('say_hello', {
        name: peer.displayName
      })));
    }
    if (conv.gapAfter) {
      out.push(m("button", {
        className: "Button pl-latest",
        onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.load(conv.summary.id)
      }, t('jump_to_latest')));
    }
    typers.forEach(uid => {
      const p = conv.summary.participants.find(x => x.id === uid) || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.card(uid);
      if (p) out.push(m("div", {
        className: "pl-typing",
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('typing', {
          name: p.displayName
        }))
      }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__["default"])(p, 28), m("div", {
        className: "pl-bub"
      }, m("i", null), m("i", null), m("i", null))));
    });
    return m("div", {
      className: "pl-w-body",
      onscroll: e => this.scrolled(e),
      "aria-live": "polite"
    }, out);
  }
  scrolled(e) {
    const el = e.target;
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 60 && this.attrs.conv.hasOlder && !this.attrs.conv.loadingOlder) {
      this.heightBefore = el.scrollHeight;
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.older(this.attrs.conv.summary.id);
    }
    e.redraw = false;
  }

  /** Who has read up to your last message: their faces, small, under it. */
  seen(conv, msg, peer) {
    const meId = Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id());
    const readers = Object.entries(conv.summary.seenBy || {}).filter(_ref => {
      let [uid, read] = _ref;
      return Number(uid) !== meId && (read || 0) >= msg.id;
    }).map(_ref2 => {
      let [uid] = _ref2;
      return conv.summary.participants.find(p => p.id === Number(uid)) || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.card(uid);
    }).filter(Boolean);
    if (conv.summary.type === 'room' || !readers.length) return null;

    // In a one-to-one, only once they have read the very last message.
    if (!conv.summary.isGroup && msg.id !== Math.max(...conv.messages.filter(x => !x.pending).map(x => x.id))) return null;
    const names = readers.map(p => p.displayName).join(', ');
    return m("div", {
      className: "pl-seen",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('seen_by', {
        names
      })),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('seen_by', {
        names
      }))
    }, (conv.summary.isGroup ? readers.slice(0, 5) : [peer]).map(p => (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__["default"])(p, 14)), readers.length > 5 ? m("span", {
      className: "pl-seen-more"
    }, "+", readers.length - 5) : null);
  }
  pendingLine(msg) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    if (msg.failed) {
      return m("div", {
        className: "pl-time me failed"
      }, msg.error || t('not_sent'), ' · ', m("button", {
        className: "Button Button--link",
        onclick: () => s.retry(msg.nonce)
      }, t('retry')), ' · ', m("button", {
        className: "Button Button--link",
        onclick: () => s.discard(msg.nonce)
      }, t('delete')));
    }
    return m("div", {
      className: "pl-time me"
    }, msg.waiting ? t('waiting_for_connection') : t('sending'));
  }
  chips(msg, meId, who) {
    const chips = (0,_util__WEBPACK_IMPORTED_MODULE_6__.tally)(msg.reactions);
    if (!chips.length) return null;
    return m("div", {
      className: 'pl-chips ' + who
    }, chips.map(_ref3 => {
      let [emoji, n] = _ref3;
      return m("button", {
        className: 'pl-chip' + (msg.reactions.some(r => r.userId === meId && r.emoji === emoji) ? ' mine' : ''),
        onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.react(msg.id, emoji),
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('reaction_count', {
          emoji,
          count: n
        }))
      }, emoji, n > 1 ? m("span", null, n) : null);
    }));
  }
  bubble(msg) {
    if (msg.deleted) return m("div", {
      className: "pl-bub deleted"
    }, t('deleted'));
    const quote = msg.replyTo ? m("div", {
      className: "pl-quote"
    }, msg.replyTo.authorName ? m("b", null, msg.replyTo.authorName) : null, m("span", null, msg.replyTo.excerpt ?? flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(msg.replyTo.type === 'text' ? t('deleted') : t('attachment')))) : null;
    const pin = msg.pinned ? m("span", {
      className: "pl-pinmark",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('pinned'))
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].pin()) : null;
    const meta = msg.meta || {};
    const src = _api__WEBPACK_IMPORTED_MODULE_5__["default"].fileUrl(msg.id);
    if (msg.type === 'image') {
      const w = Math.min(240, meta.w || 240);
      const h = meta.w ? Math.round(w / meta.w * meta.h) : 160;
      return m("div", {
        className: "pl-bub pl-media"
      }, quote, pin, m("a", {
        href: src,
        target: "_blank",
        rel: "noopener"
      }, m("img", {
        src: src,
        width: w,
        height: h,
        alt: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('photo')),
        loading: "lazy"
      })));
    }
    if (msg.type === 'video') {
      return m("div", {
        className: "pl-bub pl-media"
      }, quote, pin, m("video", {
        src: src,
        controls: true,
        preload: "metadata",
        playsinline: true,
        width: "240"
      }));
    }
    if (msg.type === 'voice') {
      return m("div", {
        className: "pl-bub pl-voice"
      }, pin, m(VoicePlayer, {
        src: src,
        seconds: meta.duration
      }));
    }
    if (msg.type === 'file') {
      return m("div", {
        className: "pl-bub pl-file"
      }, quote, pin, m("a", {
        href: src,
        download: meta.name || '',
        rel: "noopener"
      }, m("span", {
        className: "pl-file-icon"
      }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].file()), m("span", {
        className: "pl-file-info"
      }, m("span", {
        className: "pl-file-name"
      }, meta.name || flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('file'))), m("span", {
        className: "pl-file-size"
      }, (0,_labels__WEBPACK_IMPORTED_MODULE_7__.fileSize)(meta.size)))));
    }

    // A single emoji, or two or three, read better big and without a bubble.
    const big = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍){1,8}$/u.test((msg.body || '').trim()) && !quote;
    return m("div", {
      className: 'pl-bub' + (big ? ' pl-big' : '')
    }, quote, pin, (0,_util__WEBPACK_IMPORTED_MODULE_6__.linkParts)(msg.body || '').map(part => typeof part === 'string' ? (0,_util__WEBPACK_IMPORTED_MODULE_6__.mentionParts)(part).map(bit => typeof bit === 'string' ? bit : m("b", {
      className: "pl-mention"
    }, "@", bit.username)) : m("a", {
      href: part.url,
      target: "_blank",
      rel: "nofollow ugc noopener"
    }, part.url)));
  }
  tray(msg, mine) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const conv = this.attrs.conv;
    const menuOpen = this.menuFor === msg.id;
    return m("div", {
      className: 'pl-react-tray' + (menuOpen ? ' open' : ''),
      role: "group",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('react'))
    }, (s.config.reactions || []).map(e => m("button", {
      "aria-label": e,
      onclick: () => s.react(msg.id, e)
    }, e)), m("button", {
      className: "pl-rp",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('reply')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('reply')),
      onclick: () => {
        s.replyTo[conv.summary.id] = msg;
        document.getElementById(`Parley-input-${conv.summary.id}`)?.focus();
      }
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].reply()), m("button", {
      className: "pl-rp pl-more",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('more')),
      "aria-expanded": String(menuOpen),
      onclick: () => {
        this.menuFor = menuOpen ? null : msg.id;
        this.confirmDelete = null;
      }
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].more()), menuOpen ? this.menu(msg, mine) : null);
  }
  menu(msg, mine) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const conv = this.attrs.conv;
    const id = conv.summary.id;
    const isRoom = conv.summary.type === 'room';
    const done = () => {
      this.menuFor = null;
      this.confirmDelete = null;
    };
    if (this.confirmDelete === msg.id) {
      return m("div", {
        className: "pl-msg-menu Dropdown-menu"
      }, m("button", {
        className: "danger",
        onclick: () => s.remove(msg.id).then(done)
      }, t('delete_for_everyone')), m("button", {
        onclick: done
      }, t('cancel')));
    }
    const canPin = !isRoom || s.config.canModerate;
    return m("div", {
      className: "pl-msg-menu Dropdown-menu"
    }, msg.type === 'text' ? m("button", {
      onclick: () => {
        navigator.clipboard?.writeText(msg.body || '').catch(() => {});
        done();
      }
    }, t('copy')) : null, mine && msg.type === 'text' ? m("button", {
      onclick: () => {
        s.editing[id] = msg;
        done();
        setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
      }
    }, t('edit')) : null, canPin ? m("button", {
      onclick: () => {
        s.pin(msg.id, !msg.pinned);
        done();
      }
    }, msg.pinned ? t('unpin') : t('pin')) : null, m("button", {
      onclick: () => {
        done();
        flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().modal.show(() => __webpack_require__.e(/*! import() | forum/components/ForwardModal */ "ernestdefoe-parley:forum/components/ForwardModal").then(() => (__webpack_require__(/*! ./ForwardModal */ "./src/forum/components/ForwardModal.js"))), {
          message: msg
        });
      }
    }, t('forward')), mine || isRoom && s.config.canModerate ? m("button", {
      className: "danger",
      onclick: () => this.confirmDelete = msg.id
    }, t('delete')) : null, !mine ? m("button", {
      className: "danger",
      onclick: () => {
        s.reporting = {
          conversationId: id,
          message: msg
        };
        done();
      }
    }, t('report')) : null);
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
    const length = d ? (0,_labels__WEBPACK_IMPORTED_MODULE_7__.duration)(d) : null;
    const iCalled = (meta.callerId || msg.userId) === Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id());
    const answered = meta.outcome === 'completed';
    const text = answered ? [t(video ? 'call_video' : 'call_voice'), length ? ' · ' + length : ''] : iCalled ? t(meta.outcome === 'declined' ? video ? 'call_video_declined' : 'call_voice_declined' : video ? 'call_video_unanswered' : 'call_voice_unanswered') : t('call_missed');
    return m("div", {
      className: 'pl-sys pl-call' + (!answered && !iCalled ? ' missed' : ''),
      "data-id": msg.id
    }, video ? _icons__WEBPACK_IMPORTED_MODULE_4__["default"].video() : _icons__WEBPACK_IMPORTED_MODULE_4__["default"].phone(), m("span", null, text), m("span", null, (0,_util__WEBPACK_IMPORTED_MODULE_6__.clock)(msg.createdAt)));
  }
  dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('today'));
    if (d.toDateString() === yesterday.toDateString()) return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('yesterday'));
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric'
    });
  }
}

/**
 * A voice note: play, a bar that fills as it plays (click to jump), and the
 * time. The audio is fetched only when play is pressed.
 */
class VoicePlayer extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.playing = false;
    this.at = 0;
  }
  view() {
    const total = Number(this.attrs.seconds) || 0;
    const left = this.playing || this.at ? Math.max(0, total - this.at) : total;
    return m("div", {
      className: "pl-voice-player"
    }, m("button", {
      className: "pl-play",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t(this.playing ? 'pause' : 'play')),
      onclick: () => this.toggle()
    }, this.playing ? _icons__WEBPACK_IMPORTED_MODULE_4__["default"].pause() : _icons__WEBPACK_IMPORTED_MODULE_4__["default"].play()), m("span", {
      className: "pl-wave",
      role: "slider",
      "aria-valuemin": "0",
      "aria-valuemax": String(Math.round(total)),
      "aria-valuenow": String(Math.round(this.at)),
      onclick: e => this.seek(e)
    }, m("i", {
      style: {
        width: (total ? Math.min(100, this.at / total * 100) : 0) + '%'
      }
    })), m("span", {
      className: "pl-voice-time"
    }, (0,_labels__WEBPACK_IMPORTED_MODULE_7__.duration)(left)));
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
      a.play().catch(() => this.playing = false);
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
flarum.reg.add('ernestdefoe-parley', 'forum/components/MessageList', MessageList);flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/ForwardModal', './src/forum/components/ForwardModal.js', 'ernestdefoe-parley', 'forum/components/ForwardModal');

/***/ }

}]);
//# sourceMappingURL=ChatBody.js.map