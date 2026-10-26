/******/ (() => { // webpackBootstrap
/******/ 	// runtime can't be in strict mode because a global variable is assign and maybe created.
/******/ 	var __webpack_modules__ = ({

/***/ "./src/forum/api.js"
/*!**************************!*\
  !*** ./src/forum/api.js ***!
  \**************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);


/** Every Parley call, in one place, so the URLs live in one file. */
const url = path => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().forum.attribute('apiUrl') + '/parley' + path;
const call = function (method, path, body, extra) {
  if (extra === void 0) {
    extra = {};
  }
  return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().request({
    method,
    url: url(path),
    body,
    ...extra
  });
};

/** A request whose failure the caller handles itself: no alert. */
const quietly = {
  errorHandler: () => {}
};
const form = fields => {
  const data = new FormData();
  Object.entries(fields).forEach(_ref => {
    let [k, v] = _ref;
    return v !== undefined && v !== null && data.append(k, v);
  });
  return data;
};
const qs = params => {
  const q = new URLSearchParams(Object.entries(params).filter(_ref2 => {
    let [, v] = _ref2;
    return v !== undefined && v !== null && v !== '';
  })).toString();
  return q ? '?' + q : '';
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  rooms: parent => call('GET', '/rooms' + (parent ? `?parent=${parent}` : ''), undefined, {
    background: true,
    errorHandler: () => {}
  }),
  joinRoom: id => call('POST', `/rooms/${id}/join`),
  leaveRoom: id => call('POST', `/rooms/${id}/leave`),
  /** A page closing says goodbye; a beacon outlives the page. */
  leave() {
    const data = new FormData();
    data.append('csrfToken', (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).csrfToken);
    navigator.sendBeacon?.(url('/leave'), data);
  },
  heartbeat: body => call('POST', '/heartbeat', body, {
    background: true,
    errorHandler: () => {}
  }),
  conversations: function (filter, offset) {
    if (filter === void 0) {
      filter = 'all';
    }
    if (offset === void 0) {
      offset = 0;
    }
    return call('GET', '/conversations' + qs({
      filter,
      offset: offset || null
    }));
  },
  open: userId => call('POST', '/conversations', {
    userId
  }),
  show: function (id, params) {
    if (params === void 0) {
      params = {};
    }
    // A poll is quiet: no loading bar, no error alert if one misses.
    const quiet = params.after || params.latest;
    return call('GET', `/conversations/${id}` + qs(params), undefined, quiet ? {
      background: true,
      errorHandler: () => {}
    } : {});
  },
  /** Sent through the queue, which retries a dropped connection itself. */
  send: (id, body, replyToId, nonce) => call('POST', `/conversations/${id}/messages`, {
    body,
    replyToId,
    nonce
  }, quietly),
  upload: function (id, file, kind, extra, onprogress) {
    if (extra === void 0) {
      extra = {};
    }
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'POST',
      url: url(`/conversations/${id}/files`),
      body: form({
        file,
        kind,
        ...extra
      }),
      serialize: raw => raw,
      config: xhr => {
        if (onprogress && xhr.upload) xhr.upload.onprogress = e => e.lengthComputable && onprogress(e.loaded / e.total);
      },
      ...quietly
    });
  },
  action: function (id, action, body) {
    if (body === void 0) {
      body = {};
    }
    return call('POST', `/conversations/${id}/${action}`, body, {
      background: true,
      errorHandler: () => {}
    });
  },
  settings: (id, changes) => call('POST', `/conversations/${id}/settings`, changes),
  accept: id => call('POST', `/conversations/${id}/accept`),
  details: (id, tab, before) => call('GET', `/conversations/${id}/details` + qs({
    tab,
    before
  }), undefined, {
    background: true
  }),
  createGroup: (userIds, name) => call('POST', '/groups', {
    userIds,
    name
  }),
  renameGroup: (id, name) => call('PATCH', `/conversations/${id}`, {
    name
  }),
  groupPhoto: (id, file) => file ? flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().request({
    method: 'POST',
    url: url(`/conversations/${id}/photo`),
    body: form({
      photo: file
    }),
    serialize: raw => raw
  }) : call('DELETE', `/conversations/${id}/photo`),
  addMembers: (id, userIds) => call('POST', `/conversations/${id}/members`, {
    userIds
  }),
  removeMember: (id, userId) => call('DELETE', `/conversations/${id}/members/${userId}`),
  edit: (messageId, body) => call('PATCH', `/messages/${messageId}`, {
    body
  }),
  remove: messageId => call('DELETE', `/messages/${messageId}`),
  react: (messageId, emoji) => call('POST', `/messages/${messageId}/react`, {
    emoji
  }),
  pin: (messageId, on) => call('POST', `/messages/${messageId}/pin`, {
    on
  }),
  forward: (messageId, conversationIds) => call('POST', `/messages/${messageId}/forward`, {
    conversationIds
  }),
  report: (messageId, reason) => call('POST', `/messages/${messageId}/report`, {
    reason
  }),
  search: params => call('GET', '/search' + qs(params), undefined, {
    background: true
  }),
  people: q => call('GET', '/people?q=' + encodeURIComponent(q), undefined, {
    background: true
  }),
  person: (userId, action, on) => call('POST', `/people/${userId}/${action}`, {
    on
  }),
  reports: () => call('GET', '/reports'),
  resolve: id => call('POST', `/reports/${id}/resolve`),
  fileUrl: messageId => url(`/files/${messageId}`),
  /** Kept for anything that still asks for a picture by its old address. */
  imageUrl: messageId => url(`/files/${messageId}`)
});

/***/ },

/***/ "./src/forum/components/Avatar.js"
/*!****************************************!*\
  !*** ./src/forum/components/Avatar.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Face: () => (/* binding */ Face),
/* harmony export */   "default": () => (/* binding */ Avatar)
/* harmony export */ });
/* harmony import */ var flarum_common_utils_stringToColor__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/common/utils/stringToColor */ "flarum/common/utils/stringToColor");
/* harmony import */ var flarum_common_utils_stringToColor__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_stringToColor__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util */ "./src/forum/util.js");



/**
 * A round avatar with an optional status dot. The member's own picture when
 * they have one; otherwise their initials on the colour Flarum itself gives
 * that name, so a face here matches the same face in the discussion list.
 */
function Avatar(person, size, opts) {
  if (size === void 0) {
    size = 34;
  }
  if (opts === void 0) {
    opts = {};
  }
  const name = person.displayName || person.username || '?';
  const style = {
    '--s': size + 'px',
    '--size': size + 'px'
  };
  if (!person.avatarUrl) style['--avatar-bg'] = '#' + flarum_common_utils_stringToColor__WEBPACK_IMPORTED_MODULE_0___default()(person.username || name);
  return m("span", {
    className: 'pl-av Avatar' + (opts.className ? ' ' + opts.className : ''),
    style: style,
    "aria-hidden": "true"
  }, person.avatarUrl ? m("img", {
    src: person.avatarUrl,
    alt: "",
    loading: "lazy"
  }) : (0,_util__WEBPACK_IMPORTED_MODULE_1__.initials)(name), opts.dot ? m("span", {
    className: 'pl-dot ' + (opts.status || person.status || 'offline')
  }) : null);
}

/**
 * A conversation's face: the other person, or a group's photo, or — for a
 * group without one — two of its members, one over the other.
 */
function Face(summary, size, presenceOf) {
  if (size === void 0) {
    size = 40;
  }
  if (presenceOf === void 0) {
    presenceOf = null;
  }
  if (summary.isGroup) {
    if (summary.imageUrl) {
      return m("span", {
        className: "pl-av Avatar pl-group-photo",
        style: {
          '--s': size + 'px',
          '--size': size + 'px'
        },
        "aria-hidden": "true"
      }, m("img", {
        src: summary.imageUrl,
        alt: "",
        loading: "lazy"
      }));
    }
    const [a, b] = summary.participants || [];
    const small = Math.round(size * 0.68);
    return m("span", {
      className: "pl-stack",
      style: {
        '--s': size + 'px'
      },
      "aria-hidden": "true"
    }, a ? Avatar(a, small, {
      className: 'pl-stack-a'
    }) : null, b ? Avatar(b, small, {
      className: 'pl-stack-b'
    }) : null);
  }
  const peer = (summary.participants || [])[0] || {
    displayName: '?'
  };
  const live = presenceOf ? {
    ...peer,
    ...presenceOf(peer.id)
  } : peer;
  return Avatar(live, size, {
    dot: !!presenceOf
  });
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Avatar', Avatar);

/***/ },

/***/ "./src/forum/components/ChatWindow.js"
/*!********************************************!*\
  !*** ./src/forum/components/ChatWindow.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ChatWindow)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/ItemList */ "flarum/common/utils/ItemList");
/* harmony import */ var flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");
/* harmony import */ var _activity__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./activity */ "./src/forum/components/activity.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");










const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** The messages and the composer, fetched once, the first time a window opens. */
let Body = null;
let loading = null;
function body() {
  if (!Body && !loading) {
    loading = __webpack_require__.e(/*! import() | forum/components/ChatBody */ "ernestdefoe-parley:forum/components/ChatBody").then(() => (__webpack_require__(/*! ./ChatBody */ "./src/forum/components/ChatBody.js"))).then(mod => {
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
class ChatWindow extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.reportReason = '';
    this.searching = false;
    this.search = {
      q: '',
      results: null,
      index: 0
    };
    this.pinIndex = 0;
  }
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = this.attrs.id;
    const conv = s.conv(id);
    const page = !!this.attrs.page;
    const min = !page && s.minimised.has(id);
    if (!conv) {
      return m("section", {
        className: 'pl-win pl-loading' + (page ? ' page' : ''),
        "aria-busy": "true"
      }, m("div", {
        className: "pl-w-head"
      }, m("span", {
        className: "pl-skel"
      })));
    }
    const summary = conv.summary;
    const isRoom = summary.type === 'room';
    const room = isRoom ? {
      ...(summary.room || {}),
      ...(s.room(id) || {})
    } : null;
    const peer = summary.participants[0] || {
      displayName: '?'
    };
    const live = {
      ...peer,
      ...s.presenceOf(peer.id)
    };
    const title = isRoom ? room.name : (0,_labels__WEBPACK_IMPORTED_MODULE_9__.convTitle)(summary);
    const status = isRoom ? [room.online ? flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.online_count', {
      count: room.online
    })) : null, room.members !== undefined ? flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.members_count', {
      count: room.members
    })) : null].filter(Boolean).join(' · ') || room.description || '' : summary.isGroup ? flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('members_count', {
      count: summary.memberCount || summary.participants.length + 1
    })) : (0,_activity__WEBPACK_IMPORTED_MODULE_8__.presenceLine)(live);
    const canPost = !isRoom || !room.readonly || s.config.canModerate;
    const replying = s.replyTo[id];
    const editing = s.editing[id];
    const reporting = s.reporting && s.reporting.conversationId === id ? s.reporting.message : null;
    return m("section", {
      className: 'pl-win' + (min ? ' min' : '') + (s.flash.has(id) ? ' flash' : '') + (page ? ' page' : ''),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('label', {
        name: title
      }))
    }, m("div", {
      className: "pl-w-head"
    }, page && this.attrs.onback ? m("button", {
      className: "pl-ib pl-back",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('back')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('back')),
      onclick: this.attrs.onback
    }, _icons__WEBPACK_IMPORTED_MODULE_6__["default"].back()) : null, isRoom ? (0,_RoomTile__WEBPACK_IMPORTED_MODULE_5__["default"])(room, 34) : (0,_Avatar__WEBPACK_IMPORTED_MODULE_4__.Face)(summary, 34, s.presenceOf.bind(s)), m("div", {
      className: "pl-who",
      role: "button",
      tabindex: "0",
      onclick: () => page ? this.attrs.ondetails && this.attrs.ondetails() : s.toggleMinimised(id)
    }, m("div", {
      className: "pl-nm"
    }, title), m("div", {
      className: "pl-st"
    }, status)), this.headerItems(conv, live).toArray()), min ? null : body() ? [this.bodyTopItems(conv).toArray(), m(Body.MessageList, {
      conv: conv
    }), this.bottom(conv, {
      canPost,
      replying,
      editing,
      reporting,
      title
    })] : m("div", {
      className: "pl-w-body pl-loading-body",
      "aria-busy": "true"
    }));
  }
  bottom(conv, _ref) {
    let {
      canPost,
      replying,
      editing,
      reporting,
      title
    } = _ref;
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = conv.summary.id;
    return [conv.summary.request ? this.requestBar(conv) : null, reporting ? this.reportBar(reporting) : null, replying || editing ? m("div", {
      className: "pl-replying"
    }, m("span", null, editing ? t('editing') : t('replying_to', {
      text: replying.type === 'text' ? replying.body : (0,_labels__WEBPACK_IMPORTED_MODULE_9__.messagePreview)(replying)
    })), m("button", {
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('cancel')),
      onclick: () => {
        delete s.replyTo[id];
        delete s.editing[id];
      }
    }, _icons__WEBPACK_IMPORTED_MODULE_6__["default"].x())) : null, canPost ? m(Body.Composer, {
      conv: conv,
      title: title
    }) : m("div", {
      className: "pl-readonly"
    }, flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.readonly_note'))];
  }

  /**
   * The header buttons. Parley Calls adds voice and video in front of these,
   * at priority 100 and 90.
   */
  headerItems(conv, live) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = conv.summary.id;
    const page = !!this.attrs.page;
    const items = new (flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2___default())();
    const button = function (key, icon, label, onclick, priority, extra) {
      if (extra === void 0) {
        extra = {};
      }
      return items.add(key, m("button", {
        className: 'pl-ib' + (extra.on ? ' on' : ''),
        "data-item": key,
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(label),
        title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(label),
        "aria-pressed": extra.pressed,
        onclick: onclick
      }, icon), priority);
    };
    button('search', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].search(), t('search_in_chat'), () => this.toggleSearch(), 50, {
      on: this.searching,
      pressed: String(this.searching)
    });
    if (page) {
      button('details', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].info(), t('details'), () => this.attrs.ondetails && this.attrs.ondetails(), 30, {
        on: this.attrs.detailsOpen,
        pressed: String(!!this.attrs.detailsOpen)
      });
    }
    if (conv.summary.type === 'room') {
      button('leave', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].door(), t('leave_room'), () => s.leaveRoom(id), -5);
    }
    if (page) return items;
    button('expand', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].expand(), t('expand'), () => s.expand(id), -8);
    button('minimise', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].min(), t('minimise'), () => s.toHead(id), -10);
    button('close', _icons__WEBPACK_IMPORTED_MODULE_6__["default"].x(), t('close'), () => s.close(id), -20);
    return items;
  }

  /**
   * Drawn between the header and the messages: the pinned bar and the
   * search bar. Parley Calls puts a room's voice bar here too.
   */
  bodyTopItems(conv) {
    const items = new (flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2___default())();
    if (this.searching) items.add('search', this.searchBar(conv), 20);
    if (conv.summary.pinCount) items.add('pins', this.pinBar(conv), 10);
    return items;
  }

  // ── Pins ──────────────────────────────────────────────────────────────────

  pinBar(conv) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = conv.summary.id;
    if (!conv.pins && !conv.loadingPins) {
      conv.loadingPins = true;
      _api__WEBPACK_IMPORTED_MODULE_7__["default"].details(id, 'pins').then(r => {
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
    return m("button", {
      className: "pl-pinbar",
      onclick: () => {
        this.goTo(conv, pin.id);
        this.pinIndex = i + 1;
      }
    }, _icons__WEBPACK_IMPORTED_MODULE_6__["default"].pin(), m("span", {
      className: "pl-pinbar-text"
    }, m("b", null, pins.length > 1 ? t('pinned_count', {
      index: i + 1,
      count: pins.length
    }) : t('pinned')), m("span", null, (0,_labels__WEBPACK_IMPORTED_MODULE_9__.messagePreview)(pin))));
  }

  /** Scroll to a message, fetching the page around it when it is not drawn. */
  goTo(conv, messageId) {
    if (conv.messages.some(x => x.id === messageId)) {
      conv.jumpTo = messageId;
      m.redraw();
    } else {
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.load(conv.summary.id, {
        around: messageId
      });
    }
  }

  // ── Search in this conversation ──────────────────────────────────────────

  toggleSearch() {
    this.searching = !this.searching;
    this.search = {
      q: '',
      results: null,
      index: 0
    };
    if (this.searching) setTimeout(() => document.getElementById(`Parley-find-${this.attrs.id}`)?.focus(), 0);
  }
  searchBar(conv) {
    const r = this.search.results;
    const run = e => {
      e.preventDefault();
      const q = this.search.q.trim();
      if (q.length < 2) return;
      _api__WEBPACK_IMPORTED_MODULE_7__["default"].search({
        q,
        conversation: conv.summary.id
      }).then(res => {
        this.search.results = res.messages;
        this.search.index = 0;
        if (res.messages.length) this.goTo(conv, res.messages[0].id);
        m.redraw();
      });
    };
    const step = d => {
      if (!r || !r.length) return;
      this.search.index = (this.search.index + d + r.length) % r.length;
      this.goTo(conv, r[this.search.index].id);
    };
    return m("form", {
      className: "pl-findbar",
      onsubmit: run
    }, _icons__WEBPACK_IMPORTED_MODULE_6__["default"].search(), m("input", {
      id: `Parley-find-${conv.summary.id}`,
      className: "FormControl",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('search_in_chat')),
      value: this.search.q,
      oninput: e => {
        this.search.q = e.target.value;
        this.search.results = null;
      },
      onkeydown: e => {
        // 🚨 Not `e.key === 'Escape' && …`: a handler that returns false
        // makes Mithril cancel the key, and nothing could be typed.
        if (e.key === 'Escape') this.toggleSearch();
      }
    }), r ? m("span", {
      className: "pl-find-count"
    }, r.length ? t('result_of', {
      index: this.search.index + 1,
      count: r.length
    }) : t('no_results')) : null, r && r.length > 1 ? m("span", {
      className: "pl-find-steps"
    }, m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('older_result')),
      onclick: () => step(1)
    }, m("i", {
      className: "fas fa-chevron-up",
      "aria-hidden": "true"
    })), m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('newer_result')),
      onclick: () => step(-1)
    }, m("i", {
      className: "fas fa-chevron-down",
      "aria-hidden": "true"
    }))) : null, m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('close_search')),
      onclick: () => this.toggleSearch()
    }, _icons__WEBPACK_IMPORTED_MODULE_6__["default"].x()));
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  /** A first message from someone you do not follow: accept, delete or block. */
  requestBar(conv) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = conv.summary.id;
    const peer = conv.summary.participants[0] || {};
    const name = conv.summary.isGroup ? (0,_labels__WEBPACK_IMPORTED_MODULE_9__.convTitle)(conv.summary) : peer.displayName;
    return m("div", {
      className: "pl-request"
    }, m("p", null, conv.summary.isGroup ? t('request_group', {
      name
    }) : t('request_from', {
      name
    })), m("p", {
      className: "helpText"
    }, t('request_help')), m("div", {
      className: "pl-request-actions"
    }, m("button", {
      className: "Button Button--primary",
      onclick: () => s.accept(id)
    }, t('accept')), m("button", {
      className: "Button",
      onclick: () => s.hide(id)
    }, t('delete_request')), !conv.summary.isGroup && peer.id ? m("button", {
      className: "Button Button--danger",
      onclick: () => s.block(peer.id, true).then(() => s.hide(id))
    }, t('block')) : null));
  }
  reportBar(message) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const close = () => {
      s.reporting = null;
      this.reportReason = '';
    };
    return m("form", {
      className: "pl-report",
      onsubmit: e => {
        e.preventDefault();
        _api__WEBPACK_IMPORTED_MODULE_7__["default"].report(message.id, this.reportReason || null).then(() => {
          close();
          flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
            type: 'success'
          }, t('reported'));
          m.redraw();
        });
      }
    }, m("p", null, t('report_prompt')), m("input", {
      id: `Parley-report-${message.id}`,
      className: "FormControl",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('report_reason')),
      maxlength: "500",
      oninput: e => this.reportReason = e.target.value
    }), m("div", {
      className: "pl-report-actions"
    }, m("button", {
      type: "button",
      className: "Button",
      onclick: close
    }, t('cancel')), m("button", {
      className: "Button Button--danger"
    }, t('report_send'))));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/ChatWindow', ChatWindow);flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/ChatBody', './src/forum/components/ChatBody.js', 'ernestdefoe-parley', 'forum/components/ChatBody');
flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/ChatBody', './src/forum/components/ChatBody.js', 'ernestdefoe-parley', 'forum/components/Composer');
flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/ChatBody', './src/forum/components/ChatBody.js', 'ernestdefoe-parley', 'forum/components/MessageList');

/***/ },

/***/ "./src/forum/components/Heads.js"
/*!***************************************!*\
  !*** ./src/forum/components/Heads.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Heads)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");






const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** Conversations folded down to a face, stacked up the right edge. */
class Heads extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    return m("div", {
      className: 'pl-heads' + (s.open.length ? ' above' : '')
    }, s.heads.filter(id => s.conv(id)).map(id => {
      // Filtered first: a keyed list must not start with a null hole.
      const conv = s.conv(id);
      const name = (0,_labels__WEBPACK_IMPORTED_MODULE_5__.convTitle)(conv.summary);
      const unread = s.unread[id] || 0;
      return m("button", {
        key: id,
        className: "pl-head",
        title: name,
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('open_with', {
          name
        })),
        onclick: () => s.show(id)
      }, conv.summary.type === 'room' ? (0,_RoomTile__WEBPACK_IMPORTED_MODULE_4__["default"])({
        ...(conv.summary.room || {}),
        ...(s.room(id) || {})
      }, 50) : (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__.Face)(conv.summary, 50, s.presenceOf.bind(s)), unread ? m("span", {
        className: "pl-unread"
      }, unread > 99 ? '99+' : unread) : null, m("span", {
        className: "pl-x",
        role: "button",
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('close')),
        onclick: e => {
          e.stopPropagation();
          s.close(id);
        }
      }, "\xD7"));
    }));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Heads', Heads);

/***/ },

/***/ "./src/forum/components/MessageNotification.js"
/*!*****************************************************!*\
  !*** ./src/forum/components/MessageNotification.js ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MessageNotification)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/forum/components/Notification */ "flarum/forum/components/Notification");
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__);



/** "BuckeyeBrian sent you a message" — opens the conversation. */
class MessageNotification extends (flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default()) {
  icon() {
    return 'fas fa-comment';
  }
  href() {
    const id = this.attrs.notification.content()?.conversationId;
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
      id
    });
  }
  content() {
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.notifications.message', {
      username: this.attrs.notification.fromUser()?.displayName()
    });
  }
  excerpt() {
    return null;
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/MessageNotification', MessageNotification);

/***/ },

/***/ "./src/forum/components/Parley.js"
/*!****************************************!*\
  !*** ./src/forum/components/Parley.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DOCK_BREAKPOINT: () => (/* reexport safe */ _state__WEBPACK_IMPORTED_MODULE_6__.DOCK_BREAKPOINT),
/* harmony export */   "default": () => (/* binding */ Parley)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Rail__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Rail */ "./src/forum/components/Rail.js");
/* harmony import */ var _Heads__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Heads */ "./src/forum/components/Heads.js");
/* harmony import */ var _ChatWindow__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./ChatWindow */ "./src/forum/components/ChatWindow.js");
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../state */ "./src/forum/state.js");







const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * Everything Parley draws over the forum: the rail, the heads, the dock, and
 * the "N online" pill that brings the rail back when it is hidden or the
 * screen is too narrow to dock it.
 */
class Parley extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oncreate(vnode) {
    super.oncreate(vnode);
    this.sync();

    // Re-measured when the page scrolls or resizes, which is when a theme's
    // back-to-top button comes and goes.
    let pending = null;
    this.measure = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        this.clearCorner(vnode.dom);
        // A theme fades its button in and out. Look again once the fade is
        // over, so a half-faded button neither keeps nor misses the lift.
        clearTimeout(this.settle);
        this.settle = setTimeout(() => this.clearCorner(vnode.dom), 600);
      }, 250);
    };
    window.addEventListener('scroll', this.measure, {
      passive: true
    });
    window.addEventListener('resize', this.measure);
    this.measure();
  }
  onremove(vnode) {
    super.onremove(vnode);
    window.removeEventListener('scroll', this.measure);
    window.removeEventListener('resize', this.measure);
  }

  /**
   * Keep clear of whatever else a theme fixes to the bottom-right corner —
   * Bespoke's back-to-top button, most often. The pill and the heads sit in
   * that corner too, and drawn over each other neither can be clicked.
   *
   * Found by looking at what is under the corner, not by naming one theme's
   * button, so any theme's works. Full-width bars (the composer, a cookie
   * banner) are not something to step over and are ignored.
   */
  clearCorner(root) {
    const probes = [[window.innerWidth - 34, window.innerHeight - 34], [window.innerWidth - 60, window.innerHeight - 30]];
    let lift = 0;
    for (const [x, y] of probes) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (root.contains(el) || el === document.body || el === document.documentElement) continue;
        const style = getComputedStyle(el);
        // A hidden button is usually faded out, and opacity is animated, so
        // mid-fade it reads as half there. `pointer-events: none` is how
        // themes switch it off, and that changes at once.
        if (style.position !== 'fixed' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.width > window.innerWidth / 2) continue;
        lift = Math.max(lift, window.innerHeight - r.top - 14 + 10);
      }
    }
    root.style.setProperty('--pl-lift', Math.max(0, Math.round(lift)) + 'px');
  }
  onupdate(vnode) {
    super.onupdate(vnode);
    this.sync();
  }

  /** The page makes room for the docked rail; the class lives on <body>. */
  sync() {
    const docked = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.railDocked();
    document.body.classList.toggle('Parley--docked', docked);
  }
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const docked = s.railDocked();
    const showRail = docked || s.railSheet;
    // The inbox page draws conversations itself; the dock would repeat them.
    const onInbox = s.onInbox();
    const total = s.totalUnread();
    return m("div", {
      className: 'Parley' + (docked ? ' docked' : '') + (s.railSheet ? ' sheet' : '') + (s.open.some(id => !s.minimised.has(id)) ? ' has-window' : '')
    }, showRail ? m(_Rail__WEBPACK_IMPORTED_MODULE_3__["default"], null) : null, !onInbox ? m(_Heads__WEBPACK_IMPORTED_MODULE_4__["default"], null) : null, !onInbox ? m("div", {
      className: "pl-dock"
    }, s.open.map(id => m(_ChatWindow__WEBPACK_IMPORTED_MODULE_5__["default"], {
      key: id,
      id: id
    }))) : null, !showRail && !(onInbox && s.isMobile()) ? m("button", {
      className: "pl-peek",
      onclick: () => s.toggleRail(),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rail.show'))
    }, m("span", {
      className: "pl-peek-dot"
    }), m("span", null, t('rail.peek', {
      count: s.onlineCount()
    }), total ? [' · ', t('rail.peek_unread', {
      count: total
    })] : null)) : null);
  }
}

flarum.reg.add('ernestdefoe-parley', 'forum/components/Parley', Parley);

/***/ },

/***/ "./src/forum/components/PersonRow.js"
/*!*******************************************!*\
  !*** ./src/forum/components/PersonRow.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PersonRow)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/ItemList */ "flarum/common/utils/ItemList");
/* harmony import */ var flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _activity__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./activity */ "./src/forum/components/activity.js");







const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * One person in the online list. Click anywhere on the row to message them;
 * hover for the buttons on the right.
 */
class PersonRow extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  view() {
    const p = this.attrs.person;
    const unread = this.attrs.unread || 0;
    const name = p.displayName;
    return m("div", {
      className: 'pl-person' + (p.status === 'offline' ? ' off' : ''),
      tabindex: "0",
      role: "button",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.message_person', {
        name
      })),
      onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.openWith(p.id),
      onkeydown: e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.openWith(p.id);
        }
      }
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_4__["default"])(p, 36, {
      dot: true
    }), m("div", {
      className: "pl-info"
    }, m("div", {
      className: "pl-nm"
    }, name, p.badge ? m("span", {
      className: 'pl-badge' + (p.badge.staff ? ' mod' : '')
    }, p.badge.name) : null), m("div", {
      className: "pl-act"
    }, (0,_activity__WEBPACK_IMPORTED_MODULE_6__.activityLine)(p))), unread ? m("span", {
      className: "pl-unread"
    }, unread) : null, m("span", {
      className: "pl-acts",
      onclick: e => e.stopPropagation()
    }, this.actionItems(p).toArray()));
  }

  /**
   * The hover buttons. Parley Calls adds voice and video here and takes the
   * message button away, exactly as the two editions differ in the mockup.
   */
  actionItems(p) {
    const items = new (flarum_common_utils_ItemList__WEBPACK_IMPORTED_MODULE_2___default())();
    const href = (0,_activity__WEBPACK_IMPORTED_MODULE_6__.activityHref)(p);

    // In a room you can see: "Go to" opens the room itself.
    if (p.activity && p.activity.roomId) {
      items.add('goto', m("button", {
        className: "pl-ib",
        title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.go_to', {
          place: p.activity.label
        })),
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.go_to', {
          place: p.activity.label
        })),
        onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.openRoom(p.activity.roomId)
      }, _icons__WEBPACK_IMPORTED_MODULE_5__["default"].goto()), 100);
    }
    if (href) {
      items.add('goto', m("a", {
        className: "pl-ib",
        href: href,
        title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.go_to', {
          place: p.activity.label
        })),
        "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.go_to', {
          place: p.activity.label
        })),
        onclick: e => {
          e.preventDefault();
          m.route.set(href);
        }
      }, _icons__WEBPACK_IMPORTED_MODULE_5__["default"].goto()), 100);
    }
    items.add('message', m("button", {
      className: "pl-ib",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.message')),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('rail.message_person', {
        name: p.displayName
      })),
      onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.openWith(p.id)
    }, _icons__WEBPACK_IMPORTED_MODULE_5__["default"].msg()), 0);
    return items;
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/PersonRow', PersonRow);

/***/ },

/***/ "./src/forum/components/Rail.js"
/*!**************************************!*\
  !*** ./src/forum/components/Rail.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Rail)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _PersonRow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./PersonRow */ "./src/forum/components/PersonRow.js");
/* harmony import */ var _RoomRow__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./RoomRow */ "./src/forum/components/RoomRow.js");
/* harmony import */ var _StatusMenu__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./StatusMenu */ "./src/forum/components/StatusMenu.js");
/* harmony import */ var _activity__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./activity */ "./src/forum/components/activity.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");









const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * The social panel down the right of the page: you and your status, a search,
 * the people you follow, then everyone else online.
 */
class Rail extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const me = s.me;
    const status = s.chosenStatus === 'online' && s.idle ? 'away' : s.chosenStatus;
    const f = s.filter.trim().toLowerCase();
    const match = p => !f || p.displayName.toLowerCase().includes(f) || p.username.toLowerCase().includes(f) || (p.activity?.label || '').toLowerCase().includes(f);
    const order = {
      online: 0,
      busy: 1,
      away: 2,
      offline: 3
    };
    const sort = list => [...list].sort((a, b) => order[a.status] - order[b.status] || a.displayName.localeCompare(b.displayName));
    const following = sort([...s.online.filter(p => p.following), ...s.followingOffline].filter(match));
    const rest = sort(s.online.filter(p => !p.following && match(p)));
    const listedIds = new Set([...s.online, ...s.followingOffline].map(p => p.id));
    const others = s.found.filter(p => !listedIds.has(p.id));
    const followingActive = following.filter(p => p.status !== 'away' && p.status !== 'offline').length;
    const meCard = {
      displayName: me.displayName(),
      username: me.username(),
      avatarUrl: me.avatarUrl()
    };
    return m("aside", {
      className: "pl-rail",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rail.label'))
    }, m("div", {
      className: "pl-me"
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_3__["default"])(meCard, 40, {
      dot: true,
      status: status === 'invisible' ? 'offline' : status
    }), m("div", {
      className: "pl-who"
    }, m("div", {
      className: "pl-nm"
    }, meCard.displayName), m("div", {
      className: "pl-me-line"
    }, m("button", {
      className: "pl-status-btn",
      "aria-haspopup": "menu",
      "aria-expanded": String(s.statusMenu),
      onclick: () => {
        s.statusMenu = !s.statusMenu;
      }
    }, m("i", {
      style: {
        background: (0,_StatusMenu__WEBPACK_IMPORTED_MODULE_6__.statusColor)(status)
      }
    }), t('status.' + status), " ", _icons__WEBPACK_IMPORTED_MODULE_8__["default"].chev()), this.ownLine())), m("button", {
      className: "pl-ib",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rail.hide')),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rail.hide')),
      onclick: () => s.toggleRail()
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].x())), s.statusMenu ? m(_StatusMenu__WEBPACK_IMPORTED_MODULE_6__["default"], null) : null, m("label", {
      className: "pl-search"
    }, m("span", {
      className: "pl-sr"
    }, t('rail.search')), _icons__WEBPACK_IMPORTED_MODULE_8__["default"].search(), m("input", {
      id: "Parley-search",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rail.search')),
      value: s.filter,
      autocomplete: "off",
      oninput: e => s.search(e.target.value)
    })), m("div", {
      className: "pl-rail-scroll"
    }, this.rooms(f), following.length || !f ? this.section('follow', t('rail.following'), `${followingActive}/${following.length}`, following, t('rail.following_empty')) : null, this.section('all', t('rail.online_now'), String(rest.length), rest, f ? t('rail.nobody_matches') : t('rail.nobody_online')), s.sections.all && !f && (s.more || s.guests) ? m("div", {
      className: "pl-guests"
    }, s.more ? t('rail.and_more', {
      count: s.more
    }) : null, s.more && s.guests ? ' · ' : null, s.guests ? t('rail.guests_reading', {
      count: s.guests
    }) : null) : null, others.length ? this.section('others', t('rail.other_members'), String(others.length), others.map(p => ({
      ...p,
      status: p.online ? 'online' : 'offline',
      activity: null
    })), null) : null), m("div", {
      className: "pl-rail-foot"
    }, m("span", null, status === 'invisible' ? t('rail.you_appear_offline') : t('rail.visible_as', {
      status: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('status.' + status))
    })), m("span", null, t('rail.counts', {
      members: s.onlineCount(),
      guests: s.guests
    }))));
  }

  /**
   * What you are doing, beside your status: the same line others see for you,
   * worked out here so it changes the moment you move.
   */
  ownLine() {
    const a = (0,_activity__WEBPACK_IMPORTED_MODULE_7__.ownActivity)();
    if (!a) return null;
    return m("span", {
      className: "pl-me-act"
    }, ' · ', (0,_activity__WEBPACK_IMPORTED_MODULE_7__.activityLine)({
      status: 'online',
      activity: a
    }));
  }

  /** Rooms first: they are where the forum talks together. */
  rooms(f) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const match = r => !f || r.name.toLowerCase().includes(f) || (r.description || '').toLowerCase().includes(f);
    const top = s.rooms.filter(r => !r.parentId);
    // A search reaches into opened conferences too.
    const rooms = top.filter(r => match(r) || (s.childRooms[r.id] || []).some(match));
    if (!rooms.length) return null;
    const open = s.sections.rooms !== false;
    const online = rooms.reduce((a, r) => a + (r.online || 0), 0);
    return [m("button", {
      className: "pl-sec-h",
      "aria-expanded": String(open),
      onclick: () => s.sections.rooms = !open
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].chev(), " ", t('rooms.title'), " ", m("span", {
      className: "pl-c"
    }, online ? online + ' ' + flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('rooms.here')) : rooms.length)), open ? rooms.flatMap(r => {
      const children = s.expanded.has(r.id) || f ? (s.childRooms[r.id] || []).filter(match) : [];
      // A closed conference shows none of its teams, joined or not; their
      // unread rolls up into the conference's own badge instead.
      return [m(_RoomRow__WEBPACK_IMPORTED_MODULE_5__["default"], {
        key: 'room-' + r.id,
        room: r
      }), ...children.map(c => m(_RoomRow__WEBPACK_IMPORTED_MODULE_5__["default"], {
        key: 'room-' + c.id,
        room: c,
        child: true
      }))];
    }) : null];
  }
  section(key, title, count, people, empty) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const open = s.sections[key] !== false;
    return [m("button", {
      className: "pl-sec-h",
      "aria-expanded": String(open),
      onclick: () => s.sections[key] = !open
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].chev(), " ", title, " ", m("span", {
      className: "pl-c"
    }, count)), open ? people.length ? people.map(p => m(_PersonRow__WEBPACK_IMPORTED_MODULE_4__["default"], {
      key: p.id,
      person: p,
      unread: this.unreadWith(p.id)
    })) : empty ? m("div", {
      className: "pl-guests"
    }, empty) : null : null];
  }
  unreadWith(userId) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    for (const c of s.convs.values()) {
      if (!c.summary.isGroup && c.summary.participants.some(p => p.id === userId)) return s.unread[c.summary.id] || 0;
    }
    return 0;
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Rail', Rail);

/***/ },

/***/ "./src/forum/components/ReportNotification.js"
/*!****************************************************!*\
  !*** ./src/forum/components/ReportNotification.js ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ReportNotification)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/forum/components/Notification */ "flarum/forum/components/Notification");
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__);



/** For staff: a message was reported. Opens the queue. */
class ReportNotification extends (flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default()) {
  icon() {
    return 'fas fa-flag';
  }
  href() {
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.inbox');
  }
  content() {
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.notifications.report', {
      username: this.attrs.notification.subject()?.displayName?.()
    });
  }
  excerpt() {
    return null;
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/ReportNotification', ReportNotification);

/***/ },

/***/ "./src/forum/components/RoomMentionNotification.js"
/*!*********************************************************!*\
  !*** ./src/forum/components/RoomMentionNotification.js ***!
  \*********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RoomMentionNotification)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/forum/components/Notification */ "flarum/forum/components/Notification");
/* harmony import */ var flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1__);



/** "BuckeyeBrian mentioned you in Game Day" — opens the room or the group. */
class RoomMentionNotification extends (flarum_forum_components_Notification__WEBPACK_IMPORTED_MODULE_1___default()) {
  icon() {
    return 'fas fa-at';
  }
  href() {
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
      id: this.attrs.notification.content()?.conversationId
    });
  }
  content() {
    const id = this.attrs.notification.content()?.conversationId;
    const room = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley) && flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.room(id);
    const conv = !room && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley) && flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.conv(id);
    const username = this.attrs.notification.fromUser()?.displayName();

    // A room by its name; a group by its name when this page knows it.
    if (room) return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.notifications.room_mention', {
      username,
      room: room.name
    });
    if (conv && conv.summary.isGroup && conv.summary.title) {
      return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.notifications.room_mention', {
        username,
        room: conv.summary.title
      });
    }
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.notifications.mention_plain', {
      username
    });
  }
  excerpt() {
    return null;
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/RoomMentionNotification', RoomMentionNotification);

/***/ },

/***/ "./src/forum/components/RoomRow.js"
/*!*****************************************!*\
  !*** ./src/forum/components/RoomRow.js ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RoomRow)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");





const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.' + key, params);

/** One room in the rail: its tile, its name, who is in there now. */
class RoomRow extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  view() {
    const r = this.attrs.room;
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const open = () => s.openRoom(r.id);
    const isOpen = s.expanded.has(r.id);
    // A conference's badge counts its own unread and its joined teams'.
    const unread = (r.unread || 0) + (isOpen ? 0 : r.childUnread || 0);
    return m("div", {
      className: 'pl-person pl-room' + (r.joined ? ' joined' : '') + (this.attrs.child ? ' child' : ''),
      tabindex: "0",
      role: "button",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('open', {
        name: r.name
      })),
      onclick: open,
      onkeydown: e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          open();
        }
      }
    }, (0,_RoomTile__WEBPACK_IMPORTED_MODULE_3__["default"])(r, 36), m("div", {
      className: "pl-info"
    }, m("div", {
      className: "pl-nm"
    }, r.name, r.readonly ? m("span", {
      className: "pl-badge"
    }, t('announcements')) : null, r.voiceCount ? m("span", {
      className: "pl-voice-tag",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('in_voice', {
        count: r.voiceCount
      }))
    }, _icons__WEBPACK_IMPORTED_MODULE_4__["default"].speaker(), r.voiceCount) : null), m("div", {
      className: "pl-act"
    }, r.online ? [m("i", {
      className: "pl-live-dot"
    }), t('online_count', {
      count: r.online
    }), r.description ? ' · ' : ''] : null, r.description || (r.online ? null : t('members_count', {
      count: r.members
    })))), unread ? m("span", {
      className: "pl-unread"
    }, unread > 99 ? '99+' : unread) : null, r.children ? m("button", {
      className: 'pl-ib pl-expand' + (isOpen ? ' open' : ''),
      "aria-expanded": String(isOpen),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t(isOpen ? 'hide_teams' : 'show_teams', {
        count: r.children,
        name: r.name
      })),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t(isOpen ? 'hide_teams' : 'show_teams', {
        count: r.children,
        name: r.name
      })),
      onclick: e => {
        e.stopPropagation();
        s.toggleRoomGroup(r.id);
      }
    }, m("span", {
      className: "pl-c"
    }, r.children), _icons__WEBPACK_IMPORTED_MODULE_4__["default"].chev()) : null);
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/RoomRow', RoomRow);

/***/ },

/***/ "./src/forum/components/RoomTile.js"
/*!******************************************!*\
  !*** ./src/forum/components/RoomTile.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RoomTile)
/* harmony export */ });
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/common/components/Icon */ "flarum/common/components/Icon");
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util */ "./src/forum/util.js");



/**
 * A room's face. Its own logo if one was uploaded — on a white badge in both
 * themes, because a logo is drawn for white and several vanish on dark. Then
 * its emoji; otherwise its tag's own icon on the
 * tag's colour — a conference room wears the conference logo; otherwise a #.
 *
 * The icon goes through Flarum's Icon component, exactly as the tag pages draw
 * it, so a Font Awesome kit treats it the same way everywhere.
 */
function RoomTile(room, size) {
  if (size === void 0) {
    size = 36;
  }
  const style = {
    '--s': size + 'px'
  };
  let face = '#';
  let className = 'pl-room-tile';
  if (room && room.imageUrl) {
    // Both versions are in the page; the theme decides which shows, so a
    // switch to dark mode needs no redraw. No dark version: the logo itself.
    face = [m("img", {
      className: "pl-logo-light",
      src: room.imageUrl,
      alt: "",
      loading: "lazy"
    }), room.imageDarkUrl ? m("img", {
      className: "pl-logo-dark",
      src: room.imageDarkUrl,
      alt: "",
      loading: "lazy"
    }) : null];
    className += ' image' + (room.imageDarkUrl ? ' has-dark' : '');
  } else if (room && room.emoji) {
    face = room.emoji;
  } else if (room && room.tagIcon) {
    face = m((flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0___default()), {
      name: room.tagIcon
    });
    className += ' logo';
    if (room.tagColor) {
      style.background = room.tagColor;
      // A white logo on a gold tag cannot be read; pick by the background.
      style.color = (0,_util__WEBPACK_IMPORTED_MODULE_1__.readableOn)(room.tagColor);
    }
  }
  return m("span", {
    className: className,
    style: style,
    "aria-hidden": "true"
  }, face);
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/RoomTile', RoomTile);

/***/ },

/***/ "./src/forum/components/StatusMenu.js"
/*!********************************************!*\
  !*** ./src/forum/components/StatusMenu.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   STATUSES: () => (/* binding */ STATUSES),
/* harmony export */   "default": () => (/* binding */ StatusMenu),
/* harmony export */   statusColor: () => (/* binding */ statusColor)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);


const t = key => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.status.' + key);
const STATUSES = ['online', 'away', 'busy', 'invisible'];
const statusColor = s => s === 'invisible' ? 'var(--pl-offline)' : `var(--pl-${s})`;

/**
 * Online, Away, Busy, Appear offline — the Battle.net four. Away is also set
 * for you after the idle time, and lifts itself when you come back.
 */
class StatusMenu extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oncreate(vnode) {
    super.oncreate(vnode);
    this.away = e => {
      if (!vnode.dom.contains(e.target) && !e.target.closest('.pl-status-btn')) {
        (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).statusMenu = false;
        m.redraw();
      }
    };
    this.esc = e => {
      if (e.key === 'Escape') {
        (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).statusMenu = false;
        m.redraw();
      }
    };
    document.addEventListener('pointerdown', this.away);
    document.addEventListener('keydown', this.esc);
    vnode.dom.querySelector('[aria-checked="true"]')?.focus();
  }
  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('pointerdown', this.away);
    document.removeEventListener('keydown', this.esc);
  }
  view() {
    const current = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).chosenStatus;
    return m("div", {
      className: "pl-menu",
      role: "menu"
    }, STATUSES.map(s => m("button", {
      role: "menuitemradio",
      "aria-checked": String(s === current),
      onclick: () => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.setStatus(s)
    }, m("i", {
      style: {
        background: statusColor(s)
      }
    }), m("span", null, t(s), m("small", null, s === 'busy' && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).callsInstalled ? t('busy_desc_calls') : t(s + '_desc'))))));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/StatusMenu', StatusMenu);

/***/ },

/***/ "./src/forum/components/activity.js"
/*!******************************************!*\
  !*** ./src/forum/components/activity.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   activityHref: () => (/* binding */ activityHref),
/* harmony export */   activityLine: () => (/* binding */ activityLine),
/* harmony export */   ownActivity: () => (/* binding */ ownActivity),
/* harmony export */   presenceLine: () => (/* binding */ presenceLine)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/humanTime */ "flarum/common/utils/humanTime");
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_2__);



const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.activity.' + key, params);

/**
 * The line under a name in the online list: "Reading · <b>Ohio State at
 * Michigan</b>". The label is bold in the accent colour when it names a place
 * you can go, as in the mockup.
 */
function activityLine(p) {
  const a = p.activity;
  if (p.status === 'offline') {
    return p.lastSeenAt ? t('last_seen', {
      ago: flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_2___default()(p.lastSeenAt)
    }) : t('offline');
  }
  if (!a) return p.status === 'busy' ? [t('busy'), ' · ', t('dnd')] : t('online');
  switch (a.verb) {
    case 'reading':
      return [t('reading'), ' · ', m("b", null, a.label)];
    case 'replying':
      return [t('replying'), ' · ', m("b", null, a.label)];
    case 'browsing':
      return [t('browsing'), ' · ', m("b", null, a.label)];
    case 'browsing_all':
      return [t('browsing'), ' · ', t('all_discussions')];
    case 'chatting':
      return [t('chatting'), ' · ', m("b", null, a.label)];
    case 'in_voice':
      return [t('in_voice'), ' · ', m("b", null, a.label)];
    case 'away':
      return [t('away'), ' · ', t('idle', {
        minutes: a.idleMinutes
      })];
    case 'busy':
      return [t('busy'), ' · ', t('dnd')];
    default:
      return t('online');
  }
}

/** The quieter line in a window header: "Reading · Ohio State…", "Active now". */
function presenceLine(p) {
  const a = p.activity;
  if (p.status === 'offline') {
    return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(p.lastSeenAt ? t('last_seen', {
      ago: flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_2___default()(p.lastSeenAt)
    }) : t('offline'));
  }
  if (p.status === 'away') return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(t('away')) + ' · ' + flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(t('idle', {
    minutes: a?.idleMinutes || 1
  }));
  if (p.status === 'busy') return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(t('busy')) + ' · ' + flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()((flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).callsInstalled ? t('calls_muted') : t('dnd'));
  if (a && ['reading', 'replying', 'chatting', 'in_voice'].includes(a.verb)) return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(t(a.verb)) + ' · ' + a.label;
  return flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(t('active_now'));
}

/** Where "Go to" takes you, or null when there is nowhere to go. */
function activityHref(p) {
  const a = p.activity;
  if (!a) return null;
  if (a.discussionId) {
    // The slug driver already leads with the id: `12-the-reading-room`.
    return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('discussion.near', {
      id: a.slug || a.discussionId,
      near: a.near || 1
    });
  }
  if (a.tagSlug) return flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('tag', {
    tags: a.tagSlug
  });
  return null;
}

/**
 * What you are doing yourself, worked out in this browser from where you are,
 * so your own row changes the moment you move. Same words others see for you,
 * with the place's name taken from what this page has already loaded.
 */
function ownActivity() {
  const w = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.where();
  if (w.place === 'voice' || w.place === 'room') {
    const room = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.room(w.roomId) || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.conv(w.roomId)?.summary?.room;
    return room ? {
      verb: w.place === 'voice' ? 'in_voice' : 'chatting',
      label: room.name,
      roomId: w.roomId
    } : null;
  }
  if (w.place === 'discussion' || w.place === 'reply') {
    const d = w.discussionId && flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().store.getById('discussions', String(w.discussionId));
    if (!d) return null;
    return {
      verb: w.place === 'reply' ? 'replying' : 'reading',
      label: d.title()
    };
  }
  if (w.place === 'tag' && w.tagId) {
    const tag = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().store.getById('tags', String(w.tagId));
    return tag ? {
      verb: 'browsing',
      label: tag.name()
    } : null;
  }
  if (w.place === 'index') return {
    verb: 'browsing_all',
    label: null
  };
  return null;
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/activity', { activityLine: activityLine,presenceLine: presenceLine,activityHref: activityHref,ownActivity: ownActivity, });

/***/ },

/***/ "./src/forum/icons.js"
/*!****************************!*\
  !*** ./src/forum/icons.js ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/common/components/Icon */ "flarum/common/components/Icon");
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0__);


/*
 * Parley's icons are the forum's own Font Awesome icons, drawn through
 * Flarum's Icon component: a theme or a Font Awesome kit that changes the
 * forum's icons changes these too. Same calls as before — `Icons.x()`.
 */
const icon = name => () => m((flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_0___default()), {
  name: name
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  phone: icon('fas fa-phone'),
  video: icon('fas fa-video'),
  msg: icon('far fa-comment'),
  min: icon('fas fa-minus'),
  x: icon('fas fa-times'),
  send: icon('fas fa-paper-plane'),
  img: icon('far fa-image'),
  chev: icon('fas fa-chevron-down'),
  search: icon('fas fa-search'),
  goto: icon('fas fa-arrow-right'),
  more: icon('fas fa-ellipsis-h'),
  expand: icon('fas fa-expand-alt'),
  speaker: icon('fas fa-volume-up'),
  door: icon('fas fa-sign-out-alt'),
  people: icon('fas fa-user-friends'),
  plus: icon('fas fa-plus'),
  emoji: icon('far fa-smile'),
  mic: icon('fas fa-microphone'),
  stop: icon('fas fa-stop'),
  play: icon('fas fa-play'),
  pause: icon('fas fa-pause'),
  file: icon('far fa-file-alt'),
  forward: icon('fas fa-share'),
  reply: icon('fas fa-reply'),
  pin: icon('fas fa-thumbtack'),
  info: icon('fas fa-info-circle'),
  back: icon('fas fa-arrow-left'),
  star: icon('fas fa-star'),
  muted: icon('fas fa-bell-slash'),
  bell: icon('fas fa-bell'),
  archive: icon('fas fa-archive'),
  tag: icon('fas fa-tag'),
  edit: icon('fas fa-pencil-alt'),
  camera: icon('fas fa-camera'),
  newGroup: icon('fas fa-users'),
  compose: icon('fas fa-pen-to-square'),
  trash: icon('far fa-trash-alt'),
  ban: icon('fas fa-ban'),
  check: icon('fas fa-check'),
  link: icon('fas fa-link'),
  inbox: icon('fas fa-inbox'),
  at: icon('fas fa-at')
});

/***/ },

/***/ "./src/forum/index.js"
/*!****************************!*\
  !*** ./src/forum/index.js ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Avatar: () => (/* reexport safe */ _components_Avatar__WEBPACK_IMPORTED_MODULE_13__["default"]),
/* harmony export */   ChatWindow: () => (/* reexport safe */ _components_ChatWindow__WEBPACK_IMPORTED_MODULE_11__["default"]),
/* harmony export */   Icons: () => (/* reexport safe */ _icons__WEBPACK_IMPORTED_MODULE_14__["default"]),
/* harmony export */   ParleyState: () => (/* reexport safe */ _state__WEBPACK_IMPORTED_MODULE_5__["default"]),
/* harmony export */   PersonRow: () => (/* reexport safe */ _components_PersonRow__WEBPACK_IMPORTED_MODULE_12__["default"])
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/extend */ "flarum/common/extend");
/* harmony import */ var flarum_common_extend__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/Page */ "flarum/common/components/Page");
/* harmony import */ var flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var flarum_forum_utils_UserControls__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! flarum/forum/utils/UserControls */ "flarum/forum/utils/UserControls");
/* harmony import */ var flarum_forum_utils_UserControls__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_utils_UserControls__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./state */ "./src/forum/state.js");
/* harmony import */ var _components_Parley__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./components/Parley */ "./src/forum/components/Parley.js");
/* harmony import */ var _components_MessageNotification__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./components/MessageNotification */ "./src/forum/components/MessageNotification.js");
/* harmony import */ var _components_ReportNotification__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./components/ReportNotification */ "./src/forum/components/ReportNotification.js");
/* harmony import */ var _components_RoomMentionNotification__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./components/RoomMentionNotification */ "./src/forum/components/RoomMentionNotification.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./api */ "./src/forum/api.js");
/* harmony import */ var _components_ChatWindow__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./components/ChatWindow */ "./src/forum/components/ChatWindow.js");
/* harmony import */ var _components_PersonRow__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./components/PersonRow */ "./src/forum/components/PersonRow.js");
/* harmony import */ var _components_Avatar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./components/Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./icons */ "./src/forum/icons.js");
















const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.' + key, params);
flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().initializers.add('ernestdefoe-parley', () => {
  /*
   * 🚨 Not /messages: flarum/messages owns it, and two routes on one path stop
   * the whole forum booting. Not /chat either, which ramon/chat holds while
   * both are installed during a switch-over.
   */
  // The messenger loads when someone first goes there, never with other pages.
  const InboxPage = () => __webpack_require__.e(/*! import() | forum/components/InboxPage */ "ernestdefoe-parley:forum/components/InboxPage").then(() => (__webpack_require__(/*! ./components/InboxPage */ "./src/forum/components/InboxPage.js")));
  (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().routes)['parley.inbox'] = {
    path: '/parley',
    component: InboxPage
  };
  (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().routes)['parley.conversation'] = {
    path: '/parley/:id',
    component: InboxPage
  };
  (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().notificationComponents).parleyMessage = _components_MessageNotification__WEBPACK_IMPORTED_MODULE_7__["default"];
  (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().notificationComponents).parleyReport = _components_ReportNotification__WEBPACK_IMPORTED_MODULE_8__["default"];
  (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().notificationComponents).parleyRoomMention = _components_RoomMentionNotification__WEBPACK_IMPORTED_MODULE_9__["default"];

  /*
   * 🚨 Started from `mount`, not from the initializer. `app.forum` and the
   * session are filled in while the app boots, AFTER initializers run, and a
   * throw in an initializer is silent — the extension simply never starts.
   *
   * Patched on the `app` instance: Flarum 2 does not register
   * `forum/ForumApplication` as a module, so importing it gives undefined and
   * `.prototype` of that takes the whole initializer down.
   */
  (0,flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__.extend)((flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default()), 'mount', function () {
    const config = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().forum.attribute('parley') || {};
    if (!(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user) {
      guestHeartbeat();
      return;
    }
    if (!config.canUse) return;
    (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley) = new _state__WEBPACK_IMPORTED_MODULE_5__["default"]();
    const root = document.createElement('div');
    root.id = 'Parley-root';
    document.body.appendChild(root);
    m.mount(root, _components_Parley__WEBPACK_IMPORTED_MODULE_6__["default"]);
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.start();
  });

  // A new page is a new place: tell the online list now, not in 30 seconds.
  (0,flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__.extend)((flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_2___default().prototype), 'oncreate', function () {
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley?.moved();
  });
  (0,flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__.extend)((flarum_forum_utils_UserControls__WEBPACK_IMPORTED_MODULE_4___default()), 'userControls', function (items, user) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    if (!s || !(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user || user === (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user) return;
    items.add('parleyMessage', m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3___default()), {
      icon: "fas fa-comment",
      onclick: () => s.openWith(user.id())
    }, t('controls.message')), 100);
    const following = s.online.some(p => p.id === Number(user.id()) && p.following) || s.followingOffline.some(p => p.id === Number(user.id()));
    items.add('parleyFollow', m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3___default()), {
      icon: following ? 'fas fa-user-minus' : 'fas fa-user-plus',
      onclick: () => s.follow(user.id(), !following)
    }, following ? t('controls.unfollow') : t('controls.follow')), 90);
  });
  (0,flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__.extend)((flarum_forum_utils_UserControls__WEBPACK_IMPORTED_MODULE_4___default()), 'destructiveControls', function (items, user) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    if (!s || !(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user || user === (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user) return;
    items.add('parleyBlock', m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_3___default()), {
      icon: "fas fa-ban",
      onclick: () => s.block(user.id(), true).then(() => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
        type: 'success'
      }, t('controls.blocked', {
        name: user.displayName()
      })))
    }, t('controls.block')));
  });

  // "Who can message me", beside the other privacy choices. Named by module
  // path: the settings page is code-split in Flarum 2.
  (0,flarum_common_extend__WEBPACK_IMPORTED_MODULE_1__.extend)('flarum/forum/components/SettingsPage', 'privacyItems', function (items) {
    if (!(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley)) return;
    const user = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user;
    const current = user.preferences()?.parleyWhoCanMessage || 'everyone';
    items.add('parleyWhoCanMessage', m("div", {
      className: "Form-group"
    }, m("label", {
      htmlFor: "Parley-who-can-message"
    }, t('settings.who_can_message')), m("select", {
      id: "Parley-who-can-message",
      className: "FormControl",
      value: current,
      onchange: e => user.savePreferences({
        parleyWhoCanMessage: e.target.value
      })
    }, m("option", {
      value: "everyone"
    }, t('settings.everyone')), m("option", {
      value: "everyone_inbox"
    }, t('settings.everyone_inbox')), m("option", {
      value: "following"
    }, t('settings.following')), m("option", {
      value: "nobody"
    }, t('settings.nobody'))), m("p", {
      className: "helpText"
    }, t('settings.who_can_message_help'))), -10);
  });
});

/**
 * Guests are counted in "and 41 guests reading", never listed, never shown a
 * rail. One small request every 30 seconds while the tab is in view.
 */
function guestHeartbeat() {
  const beat = () => {
    if (document.visibilityState !== 'visible') return;
    _api__WEBPACK_IMPORTED_MODULE_10__["default"].heartbeat({
      place: 'other'
    });
  };
  beat();
  setInterval(beat, 30000);
}flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/InboxPage', './src/forum/components/InboxPage.js', 'ernestdefoe-parley', 'forum/components/InboxPage');
flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/InboxPage', './src/forum/components/InboxPage.js', 'ernestdefoe-parley', 'forum/components/Details');

/***/ },

/***/ "./src/forum/labels.js"
/*!*****************************!*\
  !*** ./src/forum/labels.js ***!
  \*****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   convTitle: () => (/* binding */ convTitle),
/* harmony export */   duration: () => (/* binding */ duration),
/* harmony export */   fileSize: () => (/* binding */ fileSize),
/* harmony export */   messagePreview: () => (/* binding */ messagePreview),
/* harmony export */   systemLine: () => (/* binding */ systemLine)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1__);



/*
 * How a conversation and a message read in a line of text: the list, the
 * heads, the window title, the forward picker and system rows all say it
 * the same way.
 */

const t = (key, params) => flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_1___default()(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.' + key, params));

/** A group's own name, or its people's names; a room's name; the other person. */
function convTitle(summary) {
  if (!summary) return '';
  if (summary.type === 'room') return summary.room && summary.room.name || summary.title || '';
  if (summary.isGroup) {
    if (summary.title) return summary.title;
    const names = (summary.participants || []).map(p => p.displayName);
    const more = (summary.memberCount || names.length + 1) - 1 - names.length;
    return more > 0 ? t('group.names_more', {
      names: names.join(', '),
      count: more
    }) : names.join(', ') || t('group.untitled');
  }
  return ((summary.participants || [])[0] || {}).displayName || '?';
}

/** "Photo", "Voice message · 0:12", the words — what a message says in one line. */
function messagePreview(msg) {
  if (!msg) return '';
  if (msg.deleted) return t('window.deleted');
  switch (msg.type) {
    case 'image':
      return '📷 ' + t('window.photo');
    case 'video':
      return '🎬 ' + t('window.video');
    case 'voice':
      return '🎤 ' + t('window.voice_note', {
        length: duration((msg.meta || {}).duration)
      });
    case 'file':
      return '📎 ' + ((msg.meta || {}).name || t('window.file'));
    case 'call':
      return t('window.call_voice');
    case 'system':
      return systemLine(msg);
    default:
      return msg.body || '';
  }
}

/** "Ana added Ben and Cy" — a group's own news, from where the reader sits. */
function systemLine(msg) {
  const meta = msg.meta || {};
  const me = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user && Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id());
  const actor = msg.userId === me ? t('system.you') : msg.author && msg.author.displayName || '?';
  const names = (meta.userIds || []).map((id, i) => id === me ? t('system.you_lower') : (meta.names || [])[i] || '?');
  const list = names.length > 1 ? t('system.and', {
    first: names.slice(0, -1).join(', '),
    last: names[names.length - 1]
  }) : names[0] || '';
  switch (meta.action) {
    case 'created':
      return meta.name ? t('system.created_named', {
        actor,
        name: meta.name
      }) : t('system.created', {
        actor
      });
    case 'renamed':
      return meta.name ? t('system.renamed', {
        actor,
        name: meta.name
      }) : t('system.unnamed', {
        actor
      });
    case 'photo':
      return t('system.photo', {
        actor
      });
    case 'photo_removed':
      return t('system.photo_removed', {
        actor
      });
    case 'added':
      return t('system.added', {
        actor,
        names: list
      });
    case 'removed':
      return t('system.removed', {
        actor,
        names: list
      });
    case 'left':
      return t('system.left', {
        actor
      });
    case 'pinned':
      return t('system.pinned', {
        actor
      });
    default:
      return '';
  }
}

/** 0:07, 12:34 */
function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** 1.2 MB, 340 KB */
function fileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1048576) return (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

/***/ },

/***/ "./src/forum/state.js"
/*!****************************!*\
  !*** ./src/forum/state.js ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DOCK_BREAKPOINT: () => (/* binding */ DOCK_BREAKPOINT),
/* harmony export */   MOBILE_BREAKPOINT: () => (/* binding */ MOBILE_BREAKPOINT),
/* harmony export */   RAIL_WIDTH: () => (/* binding */ RAIL_WIDTH),
/* harmony export */   "default": () => (/* binding */ ParleyState)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api */ "./src/forum/api.js");
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util */ "./src/forum/util.js");



const HEARTBEAT = 30000;
const HEARTBEAT_NO_REALTIME = 15000;
const POLL_OPEN = 5000;
const PRESENCE_MIN_GAP = 10000;
const TYPING_TTL = 6000;
const TYPING_SEND_EVERY = 3000;
const MAX_HEADS = 6;
/** How long a queued message waits before trying again, growing to the last. */
const RETRY_STEPS = [2000, 4000, 8000, 15000, 30000];
/** How long after you last used a room you still count as chatting in it. */
const ROOM_ACTIVE_MS = 3 * 60 * 1000;
const RAIL_WIDTH = 300;
const DOCK_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 820;

/**
 * Everything Parley knows, for every component that draws it.
 *
 * One instance per page load, reached as `app.parley`. Kept off the module's
 * default export as an INSTANCE on purpose: Flarum's auto-export loader cannot
 * register `export default new X()`, so Parley Calls reaches this through
 * `app.parley`, not an import.
 */
class ParleyState {
  constructor() {
    this.config = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().forum.attribute('parley') || {};
    const user = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session).user;
    this.me = user;
    this.chosenStatus = user && user.preferences()?.parleyStatus || 'online';
    this.idle = false;
    this.online = [];
    this.followingOffline = [];
    this.more = 0;
    this.guests = 0;
    this.loaded = false;

    /** Rooms this person can see, in the admin's order, from the heartbeat. */
    this.rooms = [];
    /** A conference's team rooms, fetched when it is opened in the rail. */
    this.childRooms = {};
    /** Which parent rooms are open in the rail; remembered between visits. */
    this.expanded = new Set();
    /** Every person met in a message, by id — a room's authors are not known up front. */
    this.cards = new Map();

    /** id → { summary, messages, hasOlder, loadingOlder, typing: {userId: until} } */
    this.convs = new Map();
    this.unread = {};
    /** Message requests waiting, and muted conversations with news: quiet counts. */
    this.requests = 0;
    this.quiet = new Set();
    /** Unsent words per conversation, kept across reloads. */
    this.drafts = {};
    /** Messages on their way: sent, retrying through a dropped connection, or refused. */
    this.queue = [];
    /** A group's members, fetched with its details, for @mentions and the details column. */
    this.members = {};
    this.open = [];
    this.heads = [];
    this.minimised = new Set();
    this.flash = new Set();
    this.replyTo = {};
    this.editing = {};
    this.reporting = null;
    /** The conversation the inbox page is showing, if it is open. */
    this.pageConversation = null;
    this.filter = '';
    this.found = [];
    this.sections = {
      rooms: true,
      follow: true,
      all: true
    };
    this.statusMenu = false;
    this.railHidden = false;
    this.railSheet = false;
    this.realtime = false;
    this.lastTypingSent = {};
    this.listeners = new Set();

    /** Set by Parley Calls when it is installed, so copy that mentions calls can say so. */
    this.callsInstalled = false;
    this.restore();
    this.restoreDrafts();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    this.bindRealtime();
    this.watchIdle();
    this.beat();
    // The heartbeat also carries unread counts, so it runs faster whenever
    // there is no live socket to deliver messages.
    const tick = () => {
      this.beat();
      this.timer = setTimeout(tick, this.socketUp() ? HEARTBEAT : HEARTBEAT_NO_REALTIME);
    };
    this.timer = setTimeout(tick, HEARTBEAT_NO_REALTIME);
    this.poller = setInterval(() => this.pollOpen(), POLL_OPEN);
    this.typingSweep = setInterval(() => this.sweepTyping(), 1000);

    // Reopen whatever was open before the page was reloaded.
    [...this.open, ...this.heads].forEach(id => this.load(id));
    window.addEventListener('resize', () => this.fit());
    // Back online: everything waiting goes now, not at its next retry.
    window.addEventListener('online', () => this.flushQueue(true));
    this.restoreQueue();
    window.addEventListener('pagehide', () => _api__WEBPACK_IMPORTED_MODULE_1__["default"].leave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.presenceStale) {
        this.presenceStale = false;
        this.presenceChanged();
      }
    });

    /*
     * 🚨 Moving is noticed by watching, not by Flarum's page hooks. Patching
     * Page.oncreate looked right and never fired when a member clicked into a
     * discussion in Flarum 2, so "Reading · <thread>" only reached others on
     * the next 30-second heartbeat. Once a second is cheap: where() reads the
     * URL and the composer, no request unless the answer changed. Scrolling
     * within a discussion changes nothing here, so it stays quiet.
     */
    this.whereKey = this.placeKey(this.where());
    setInterval(() => {
      const key = this.placeKey(this.where());
      if (key !== this.whereKey) {
        this.whereKey = key;
        this.moved();
      }
    }, 1000);
  }
  get status() {
    if (this.chosenStatus === 'online' && this.idle) return 'away';
    return this.chosenStatus;
  }
  setStatus(status) {
    this.chosenStatus = status;
    this.statusMenu = false;
    this.beat();
    m.redraw();
  }

  /** Where the visitor is right now, in the heartbeat's terms. */
  where() {
    const base = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().forum.attribute('basePath') || '').replace(/\/$/, '');
    let path = window.location.pathname;
    if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
    const where = (0,_util__WEBPACK_IMPORTED_MODULE_2__.placeFromPath)(path);
    if (where.tagSlug) {
      const tag = flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().store.all('tags').find(t => t.slug() === where.tagSlug);
      where.tagId = tag ? Number(tag.id()) : null;
      delete where.tagSlug;
    }

    // What you are doing, most present first: talking in a room's voice
    // chat, writing a reply, chatting in a room, then the page you are on.
    const voice = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parleyVoice) && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parleyVoice).session;
    if (voice) return {
      place: 'voice',
      roomId: voice.roomId
    };

    // Writing a reply is its own activity: "Writing a reply · <thread>".
    const c = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().composer);
    const open = c && (typeof c.isVisible === 'function' ? c.isVisible() : c.position && c.position !== 'hidden');
    const composing = open && c.body?.attrs?.discussion;
    if (composing) {
      where.place = 'reply';
      where.discussionId = Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().composer.body.attrs.discussion.id());
      return where;
    }
    const room = this.activeRoom();
    if (room) return {
      place: 'room',
      roomId: room
    };
    return where;
  }

  /**
   * The room you are chatting in, if you are: one you opened, typed in or
   * sent to in the last few minutes, still open and not folded away. A room
   * window left idle stops counting, so the line does not claim a room you
   * have drifted away from.
   */
  activeRoom() {
    const use = this.roomUse;
    if (!use || Date.now() - use.at > ROOM_ACTIVE_MS) return null;
    const visible = this.pageConversation === use.id || this.open.includes(use.id) && !this.minimised.has(use.id);
    return visible && this.isRoom(use.id) ? use.id : null;
  }
  touchRoom(id) {
    id = Number(id);
    if (this.isRoom(id)) this.roomUse = {
      id,
      at: Date.now()
    };
  }
  beat() {
    this.lastBeatAt = Date.now();
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].heartbeat({
      status: this.status,
      ...this.where()
    }).then(r => {
      if (!r || !r.online) return;
      this.online = r.online;
      this.followingOffline = r.followingOffline || [];
      this.more = r.more || 0;
      this.guests = r.guests || 0;
      this.rooms = r.rooms || [];
      this.requests = r.requests || 0;
      this.quiet = new Set(r.quiet || []);
      this.loaded = true;
      // Keep the open conferences' team lists as fresh as the rest.
      this.expanded.forEach(id => this.loadChildren(id));
      this.applyUnread(r.unread || {});
      m.redraw();
    });
  }

  /** A new place; tell the list now rather than in 30s. */
  moved() {
    clearTimeout(this.movedTimer);
    // A moment's wait, so clicking through three pages sends one update.
    this.movedTimer = setTimeout(() => this.beat(), 800);
  }
  placeKey(w) {
    return [w.place, w.discussionId || '', w.tagId || '', w.roomId || ''].join(':');
  }

  // ── Idle → Away ───────────────────────────────────────────────────────────

  watchIdle() {
    const minutes = this.config.awayMinutes || 10;
    let last = Date.now();
    const active = () => {
      last = Date.now();
      if (this.idle) {
        this.idle = false;
        this.beat();
        m.redraw();
      }
    };
    ['mousemove', 'keydown', 'pointerdown', 'scroll', 'focus'].forEach(e => window.addEventListener(e, active, {
      passive: true
    }));
    setInterval(() => {
      if (!this.idle && Date.now() - last > minutes * 60000) {
        this.idle = true;
        this.beat();
        m.redraw();
      }
    }, 30000);
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  bindRealtime() {
    if (!this.config.realtime || !('flarum-realtime' in (flarum.extensions || {}))) return;
    let rt;
    try {
      rt = flarum.reg.get('flarum-realtime', 'forum/RealtimeState');
    } catch (e) {
      return;
    }
    if (!rt || typeof rt.onUserChannelReady !== 'function') return;
    this.realtime = true;

    // Re-runs on every reconnect with the new channel object, so bindings are
    // never left on a dead socket.
    // The online list goes live: a nameless "something changed" on the public
    // channel, and this page asks for its own list. Resubscribed on reconnect.
    const subscribePublic = () => {
      try {
        const channel = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().websocket) && flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().websocket.subscribe('public');
        channel && channel.bind('parley.presence', () => this.presenceChanged());
      } catch (e) {
        // No public channel: the list still refreshes every 30 seconds.
      }
    };
    rt.onUserChannelReady(channel => {
      // Here, not at start: the socket exists once this fires, and it fires
      // again after every reconnect with a fresh socket to subscribe on.
      subscribePublic();
      channel.bind('parley.message', d => this.received(d.message, d.request));
      channel.bind('parley.conversationChanged', d => this.refresh(d.conversationId));
      channel.bind('parley.removed', d => this.forget(d.conversationId));
      channel.bind('parley.messageChanged', d => this.changed(d.message));
      channel.bind('parley.read', d => this.readBy(d));
      channel.bind('parley.typing', d => this.typingFrom(d));
      this.listeners.forEach(fn => fn(channel));
    });
  }

  /**
   * Is the socket actually up? Realtime being installed is not enough: a
   * misconfigured or unreachable daemon leaves the browser "connecting" for
   * ever, and trusting it then means nothing arrives at all. Polling covers
   * every moment the socket is not connected.
   */
  socketUp() {
    if (!this.realtime) return false;
    const state = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().websocket) && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().websocket).connection && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().websocket).connection.state;
    return state === 'connected';
  }

  /**
   * Someone arrived, left or changed status. Every open page hears it at
   * once, so each waits a random second or two before asking — a hundred
   * pages should not all ask in the same instant.
   */
  presenceChanged() {
    // 🚨 A tab nobody is looking at does not ask: its own 30-second heartbeat
    // keeps it on the list, and it catches up once when it is shown again.
    // Every open tab of every member hears every signal, so without this one
    // arrival made the whole forum's background tabs heartbeat at once.
    if (document.visibilityState !== 'visible') {
      this.presenceStale = true;
      return;
    }
    if (this.presenceTimer) return;
    // And never more often than once per PRESENCE_MIN_GAP: on a busy forum
    // the signal fires every few seconds, and each one costs a full
    // heartbeat from every visible page.
    const wait = Math.max(0, (this.lastBeatAt || 0) + PRESENCE_MIN_GAP - Date.now());
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      this.beat();
    }, wait + 300 + Math.random() * 2000);
  }

  /** For Parley Calls: bind more events on the same channel. */
  onChannel(fn) {
    this.listeners.add(fn);
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  conv(id) {
    return this.convs.get(Number(id));
  }
  remember(messages) {
    (messages || []).forEach(m => m && m.author && this.cards.set(m.author.id, m.author));
  }
  card(userId) {
    return this.cards.get(Number(userId)) || this.person(userId) || null;
  }
  room(id) {
    id = Number(id);
    return this.rooms.find(r => r.id === id) || Object.values(this.childRooms).flat().find(r => r.id === id) || null;
  }
  loadChildren(parentId) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].rooms(parentId).then(r => {
      if (r && r.rooms) {
        this.childRooms[parentId] = r.rooms;
        m.redraw();
      }
    });
  }
  toggleRoomGroup(parentId) {
    parentId = Number(parentId);
    if (this.expanded.has(parentId)) {
      this.expanded.delete(parentId);
    } else {
      this.expanded.add(parentId);
      if (!this.childRooms[parentId]) this.loadChildren(parentId);
    }
    this.save();
  }
  isRoom(id) {
    const c = this.conv(id);
    return c && c.summary.type === 'room' || !!this.room(id);
  }

  /** Open a room: joining it, so its messages arrive live and it counts unread. */
  openRoom(id) {
    id = Number(id);
    const room = this.room(id);
    const go = () => this.show(id);
    if (room && !room.joined) {
      return _api__WEBPACK_IMPORTED_MODULE_1__["default"].joinRoom(id).then(r => {
        this.rooms = r.rooms || this.rooms;
        go();
      });
    }
    go();
    return Promise.resolve();
  }
  leaveRoom(id) {
    id = Number(id);
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].leaveRoom(id).then(r => {
      this.rooms = r.rooms || this.rooms;
      this.close(id);
    });
  }
  ensure(summary, messages) {
    this.remember(messages);
    const id = summary.id;
    const existing = this.convs.get(id);
    if (existing) {
      existing.summary = summary;
      if (messages) {
        existing.messages = messages;
        existing.loaded = true;
      }
      return existing;
    }
    // A summary from a list carries no messages: `loaded` says whether the
    // conversation itself has been fetched yet.
    const c = {
      summary,
      messages: messages || [],
      loaded: !!messages,
      hasOlder: (messages || []).length >= 40,
      loadingOlder: false,
      typing: {}
    };
    // Where "New messages" goes: after what was read before this visit.
    c.newFrom = summary.lastReadMessageId || 0;
    this.convs.set(id, c);
    return c;
  }

  /** A conversation changed somewhere else — another tab filed or accepted it. */
  refresh(id) {
    if (!this.conv(id)) return;
    _api__WEBPACK_IMPORTED_MODULE_1__["default"].show(id, {
      latest: 1
    }).then(r => {
      if (!r) return;
      const c = this.conv(id);
      if (c) c.summary = r.conversation;
      this.listChanged();
    });
  }

  /** Gone from a group, or the group is gone. */
  forget(id) {
    id = Number(id);
    this.close(id);
    this.convs.delete(id);
    delete this.unread[id];
    if (this.pageConversation === id) m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.inbox'));
    this.listChanged();
  }

  /** The inbox page listens for this to redraw its list from the server. */
  listChanged() {
    this.listVersion = (this.listVersion || 0) + 1;
    m.redraw();
  }
  load(id, params) {
    if (params === void 0) {
      params = {};
    }
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].show(id, params).then(r => {
      const c = this.ensure(r.conversation, r.messages);
      // Jumping to a search result or a pin replaces what is drawn, so it
      // lands in place; the newest messages are a button away.
      if (params.around) {
        const last = r.messages[r.messages.length - 1];
        c.hasOlder = true;
        c.jumpTo = Number(params.around);
        c.gapAfter = !!last && last.id < (r.conversation.lastMessage?.id || 0);
      } else {
        c.gapAfter = false;
        c.hasOlder = r.messages.length >= 40;
      }
      this.redrawPending(id);
      this.unread[id] = r.conversation.unread;
      this.markRead(id);
      m.redraw();
    }).catch(() => this.close(id));
  }

  /** Open the conversation with a person: click their row, their card, anything. */
  openWith(userId) {
    const existing = [...this.convs.values()].find(c => !c.summary.isGroup && c.summary.participants.some(p => p.id === Number(userId)));
    if (existing) return Promise.resolve(this.show(existing.summary.id));
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].open(userId).then(r => {
      this.ensure(r.conversation, r.messages);
      this.show(r.conversation.id);
    });
  }

  /** Open a conversation full size, on the inbox page. */
  expand(id) {
    id = Number(id);
    this.close(id);
    m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
      id
    }));
  }

  /** Open a conversation on the messages page, at a message when one is given. */
  openAt(id, messageId) {
    this.jumpNext = messageId ? {
      id: Number(id),
      around: Number(messageId)
    } : null;
    m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
      id
    }));
  }

  /** What the messages page does when a conversation is selected. */
  select(id) {
    const jump = this.jumpNext && this.jumpNext.id === Number(id) ? this.jumpNext : null;
    this.jumpNext = null;
    if (jump) return this.load(id, {
      around: jump.around
    });
    if (this.conv(id) && this.conv(id).loaded) return this.markRead(id);
    return this.load(id);
  }
  show(id) {
    id = Number(id);
    // On the inbox page the conversation opens there, not in a window over it.
    if (this.onInbox()) {
      m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
        id
      }));
      return;
    }
    this.heads = this.heads.filter(h => h !== id);
    this.minimised.delete(id);
    if (!this.open.includes(id)) {
      this.open.push(id);
    }
    this.fit();
    this.railSheet = false;
    this.touchRoom(id);
    this.markRead(id);
    this.save();
    m.redraw();
    if (!this.conv(id) || !this.conv(id).loaded) this.load(id);
    setTimeout(() => document.getElementById(`Parley-input-${id}`)?.focus(), 0);
  }

  /** Keep only as many windows as fit; the oldest fall back to heads. */
  fit() {
    const width = window.innerWidth;
    if (width < MOBILE_BREAKPOINT) {
      while (this.open.length > 1) this.heads.unshift(this.open.shift());
      return;
    }
    const rail = this.railDocked() ? RAIL_WIDTH : 0;
    const max = (0,_util__WEBPACK_IMPORTED_MODULE_2__.windowsThatFit)(width, rail);
    while (this.open.length > max) this.heads.unshift(this.open.shift());
    this.heads = this.heads.slice(0, MAX_HEADS);
  }
  toHead(id) {
    id = Number(id);
    this.open = this.open.filter(o => o !== id);
    if (!this.heads.includes(id)) this.heads.unshift(id);
    this.heads = this.heads.slice(0, MAX_HEADS);
    this.save();
  }
  toggleMinimised(id) {
    id = Number(id);
    this.minimised.has(id) ? this.minimised.delete(id) : this.minimised.add(id);
    if (!this.minimised.has(id)) this.markRead(id);
    this.save();
  }
  close(id) {
    id = Number(id);
    this.open = this.open.filter(o => o !== id);
    this.heads = this.heads.filter(h => h !== id);
    this.minimised.delete(id);
    delete this.replyTo[id];
    delete this.editing[id];
    this.save();
    m.redraw();
  }
  isVisible(id) {
    id = Number(id);
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
    // Open in the inbox page counts as being read, the same as a docked window.
    if (this.pageConversation === id) return true;
    return this.open.includes(id) && !this.minimised.has(id);
  }
  older(id) {
    const c = this.conv(id);
    if (!c || c.loadingOlder || !c.hasOlder || !c.messages.length) return;
    c.loadingOlder = true;
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].show(id, {
      before: c.messages[0].id
    }).then(r => {
      c.messages = [...r.messages, ...c.messages];
      c.hasOlder = r.messages.length >= 40;
      c.loadingOlder = false;
      m.redraw();
    });
  }

  // ── Messages in ───────────────────────────────────────────────────────────

  received(message, request) {
    if (request === void 0) {
      request = false;
    }
    this.remember([message]);
    const id = message.conversationId;
    const c = this.conv(id);
    if (!c) {
      // A conversation this tab has not seen yet: fetch it, then show it.
      _api__WEBPACK_IMPORTED_MODULE_1__["default"].show(id).then(r => {
        this.ensure(r.conversation, r.messages);
        this.arrived(id, message, request || r.conversation.request);
        this.listChanged();
      });
      return;
    }

    // Our own message coming back: it replaces the one drawn while sending.
    if (message.nonce) {
      c.messages = c.messages.filter(x => x.nonce !== message.nonce || !x.pending);
      this.queue = this.queue.filter(q => q.nonce !== message.nonce);
    }
    if (!c.messages.some(x => x.id === message.id)) {
      c.messages.push(message);
      c.messages.sort((a, b) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || a.id - b.id);
    }
    if (request) c.summary.request = true;
    c.summary.lastMessage = message;
    c.summary.lastMessageAt = message.createdAt;
    if (message.userId) delete c.typing[message.userId];
    this.arrived(id, message, request || c.summary.request);
    this.listChanged();
  }
  arrived(id, message, request) {
    if (request === void 0) {
      request = false;
    }
    const mine = message.userId === Number(this.me.id());

    // A request is filed quietly: no head, no flash, no count on the badge.
    if (request && !mine) {
      if (!this.isVisible(id)) this.requests = Math.max(this.requests, 1);
      m.redraw();
      return;
    }
    if (!mine) {
      if (this.isVisible(id)) {
        this.markRead(id);
      } else {
        this.unread[id] = (this.unread[id] || 0) + 1;
        // Messenger brings the conversation forward as a head. Busy keeps it
        // quiet: the badge still counts, nothing pops. A room never pops: it
        // counts in the list, it does not interrupt.
        if (!this.isRoom(id) && !this.isMuted(id) && !this.onInbox() && !this.open.includes(id) && !this.heads.includes(id) && this.status !== 'busy') {
          this.heads.unshift(id);
          this.heads = this.heads.slice(0, MAX_HEADS);
          this.save();
        }
        this.flash.add(id);
        setTimeout(() => {
          this.flash.delete(id);
          m.redraw();
        }, 1600);
      }
    }
    m.redraw();
  }
  changed(message) {
    const c = this.conv(message.conversationId);
    if (!c) return;
    const i = c.messages.findIndex(x => x.id === message.id);
    if (i >= 0) c.messages[i] = message;
    m.redraw();
  }
  readBy(_ref) {
    let {
      conversationId,
      userId,
      messageId
    } = _ref;
    const c = this.conv(conversationId);
    if (!c) return;
    if (userId === Number(this.me.id())) {
      // Read in another tab.
      this.unread[conversationId] = 0;
    } else {
      c.summary.seenBy = {
        ...(c.summary.seenBy || {}),
        [userId]: messageId
      };
    }
    m.redraw();
  }
  typingFrom(_ref2) {
    let {
      conversationId,
      userId
    } = _ref2;
    const c = this.conv(conversationId);
    if (!c) return;
    c.typing[userId] = Date.now() + TYPING_TTL;
    m.redraw();
  }
  sweepTyping() {
    let changed = false;
    const now = Date.now();
    this.convs.forEach(c => {
      for (const uid in c.typing) {
        if (c.typing[uid] < now) {
          delete c.typing[uid];
          changed = true;
        }
      }
    });
    if (changed) m.redraw();
  }
  applyUnread(map) {
    for (const key in map) {
      const id = Number(key);
      const n = map[key];
      if (n > 0 && !this.isRoom(id) && !this.quiet.has(id) && !this.onInbox() && !this.isVisible(id) && !this.open.includes(id) && !this.heads.includes(id) && this.status !== 'busy') {
        this.heads.push(id);
        if (!this.conv(id)) this.load(id);
      }
    }
    this.unread = {
      ...map
    };
    // A room counts in the list only, once you have joined it.
    this.rooms.forEach(r => {
      if (map[r.id] !== undefined) r.unread = map[r.id];
    });
    // Anything open and in view is being read, whatever the server counted.
    [...this.open, this.pageConversation].forEach(id => id && this.isVisible(id) && (this.unread[id] = 0));
    this.heads = this.heads.slice(0, MAX_HEADS);
  }

  /**
   * Without realtime: refresh the open conversations.
   *
   * The latest page, not just what is newer than the last id. "Newer than"
   * finds new messages but never sees a reaction, an edit or a read receipt
   * on one already drawn, so without realtime those would never arrive.
   */
  pollOpen() {
    if (this.socketUp() || document.visibilityState !== 'visible') return;
    this.open.forEach(id => {
      const c = this.conv(id);
      if (!c || this.minimised.has(id)) return;
      _api__WEBPACK_IMPORTED_MODULE_1__["default"].show(id, {
        latest: 1
      }).then(r => {
        if (!r) return;
        c.summary = {
          ...r.conversation,
          lastReadMessageId: Math.max(r.conversation.lastReadMessageId || 0, c.summary.lastReadMessageId || 0)
        };
        r.messages.forEach(msg => {
          const i = c.messages.findIndex(x => x.id === msg.id);
          if (i >= 0) c.messages[i] = msg;else this.received(msg, r.conversation.request);
        });
        m.redraw();
      });
    });
  }

  /**
   * Everyone online, the way a person counts the room: you included (unless
   * you appear offline), and the ones past the list's limit. The server leaves
   * you out of your own list, so the list's length alone reads "0 online"
   * while you are sitting there.
   */
  onlineCount() {
    return this.online.length + (this.more || 0) + (this.status === 'invisible' ? 0 : 1);
  }

  /** Direct messages only: a busy room should not shout from the pill, nor a muted chat. */
  totalUnread() {
    return Object.entries(this.unread).reduce((a, _ref3) => {
      let [id, n] = _ref3;
      return a + (this.isRoom(id) || this.isMuted(id) ? 0 : n || 0);
    }, 0);
  }

  /** Muted or archived: news that neither pops up nor counts on the badge. */
  isMuted(id) {
    id = Number(id);
    const c = this.conv(id);
    return c ? !!(c.summary.muted || c.summary.archived) : this.quiet.has(id);
  }
  onInbox() {
    return !!((flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().current) && (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().current).get && flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().current.get('routeName') && String(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().current.get('routeName')).startsWith('parley.'));
  }

  // ── Messages out ──────────────────────────────────────────────────────────

  /**
   * Send a message. It is drawn at once, greyed, and goes through the queue:
   * a dropped connection retries it with the same nonce (the server answers
   * a repeat with the message it already made), and a refusal leaves it
   * marked, with Retry and Delete, instead of losing the words.
   */
  send(id, body) {
    id = Number(id);
    this.touchRoom(id);
    const replyTo = this.replyTo[id];
    delete this.replyTo[id];
    this.setDraft(id, '');
    const item = {
      nonce: nonce(),
      conversationId: id,
      body,
      replyToId: replyTo ? replyTo.id : null,
      tries: 0,
      state: 'sending'
    };
    this.queue.push(item);
    this.drawPending(item, replyTo);
    this.saveQueue();
    return this.attempt(item);
  }

  /** The greyed bubble of a message on its way. */
  drawPending(item, replyTo) {
    if (replyTo === void 0) {
      replyTo = null;
    }
    const c = this.conv(item.conversationId);
    if (!c || c.messages.some(x => x.nonce === item.nonce)) return;
    c.messages.push({
      id: Number.MAX_SAFE_INTEGER - this.queue.indexOf(item),
      nonce: item.nonce,
      pending: true,
      failed: item.state === 'failed',
      conversationId: item.conversationId,
      userId: Number(this.me.id()),
      type: 'text',
      body: item.body,
      replyTo: replyTo ? {
        id: replyTo.id,
        excerpt: replyTo.body,
        type: replyTo.type
      } : null,
      reactions: [],
      createdAt: new Date().toISOString()
    });
    m.redraw();
  }
  attempt(item) {
    item.state = 'sending';
    this.markPending(item);
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].send(item.conversationId, item.body, item.replyToId, item.nonce).then(r => {
      this.queue = this.queue.filter(q => q !== item);
      this.saveQueue();
      this.received(r.message);
    }, error => {
      // No answer, or the server was having a moment: try again. Anything
      // else is the server saying no, which trying again will not change.
      const transient = !error || !error.status || error.status >= 500 || error.status === 429;
      item.tries++;
      if (transient) {
        item.state = 'waiting';
        clearTimeout(item.timer);
        item.timer = setTimeout(() => this.attempt(item), RETRY_STEPS[Math.min(item.tries - 1, RETRY_STEPS.length - 1)]);
      } else {
        item.state = 'failed';
        item.error = error.alert && error.alert.content;
      }
      this.markPending(item);
      this.saveQueue();
    });
  }
  markPending(item) {
    const c = this.conv(item.conversationId);
    const msg = c && c.messages.find(x => x.nonce === item.nonce && x.pending);
    if (msg) {
      msg.failed = item.state === 'failed';
      msg.waiting = item.state === 'waiting';
      msg.error = item.error || null;
    }
    m.redraw();
  }
  retry(nonceValue) {
    const item = this.queue.find(q => q.nonce === nonceValue);
    if (item) this.attempt(item);
  }
  discard(nonceValue) {
    const item = this.queue.find(q => q.nonce === nonceValue);
    if (item) clearTimeout(item.timer);
    this.queue = this.queue.filter(q => q.nonce !== nonceValue);
    this.convs.forEach(c => c.messages = c.messages.filter(x => x.nonce !== nonceValue || !x.pending));
    this.saveQueue();
    m.redraw();
  }
  flushQueue(now) {
    this.queue.filter(q => q.state === 'waiting').forEach(q => {
      clearTimeout(q.timer);
      if (now) this.attempt(q);
    });
  }
  saveQueue() {
    try {
      const keep = this.queue.map(_ref4 => {
        let {
          nonce,
          conversationId,
          body,
          replyToId,
          state
        } = _ref4;
        return {
          nonce,
          conversationId,
          body,
          replyToId,
          state
        };
      });
      localStorage.setItem(this.key() + ':queue', JSON.stringify(keep));
    } catch (e) {
      // No storage: the queue still works for this page.
    }
  }

  /** Messages still on their way when the page was closed go on their way again. */
  restoreQueue() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(this.key() + ':queue') || '[]');
    } catch (e) {
      // Nothing saved.
    }
    saved.forEach(q => {
      const item = {
        ...q,
        tries: 0,
        state: q.state === 'failed' ? 'failed' : 'waiting'
      };
      this.queue.push(item);
      const draw = () => this.drawPending(item);
      this.conv(item.conversationId) ? draw() : this.load(item.conversationId).then(draw);
      if (item.state !== 'failed') this.attempt(item);
    });
  }

  /** Pending messages drawn again after a conversation is fetched afresh. */
  redrawPending(id) {
    this.queue.filter(q => q.conversationId === Number(id)).forEach(q => this.drawPending(q));
  }

  /**
   * A picture, video, voice note or file. Not queued — a file cannot be kept
   * across a reload — but it reports its progress on the conversation.
   */
  upload(id, file, kind, extra) {
    if (extra === void 0) {
      extra = {};
    }
    const c = this.conv(id);
    if (c) c.uploading = {
      name: file.name || '',
      progress: 0
    };
    m.redraw();
    const done = () => {
      if (c) c.uploading = null;
      m.redraw();
    };
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].upload(id, file, kind, {
      ...extra,
      nonce: nonce()
    }, p => {
      if (c && c.uploading) {
        c.uploading.progress = p;
        m.redraw();
      }
    }).then(r => {
      done();
      this.received(r.message);
    }, error => {
      done();
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
        type: 'error'
      }, error && error.alert && error.alert.content || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('core.lib.error.generic_message'));
    });
  }

  // ── Drafts ────────────────────────────────────────────────────────────────

  setDraft(id, text) {
    id = Number(id);
    if (text && text.trim()) this.drafts[id] = text;else delete this.drafts[id];
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(this.key() + ':drafts', JSON.stringify(this.drafts));
      } catch (e) {
        // Drafts are a convenience; without storage they last the page.
      }
    }, 400);
  }
  restoreDrafts() {
    try {
      this.drafts = JSON.parse(localStorage.getItem(this.key() + ':drafts') || '{}') || {};
    } catch (e) {
      this.drafts = {};
    }
  }

  // ── Filing ────────────────────────────────────────────────────────────────

  /** Mute, archive, star or label, drawn at once and saved behind. */
  file(id, changes) {
    const c = this.conv(id);
    if (c) {
      if ('muted' in changes) c.summary.muted = changes.muted;
      if ('archived' in changes) c.summary.archived = changes.archived;
      if ('starred' in changes) c.summary.starred = changes.starred;
      if ('label' in changes) c.summary.label = changes.label;
    }
    if ('muted' in changes) changes.muted ? this.quiet.add(Number(id)) : this.quiet.delete(Number(id));
    m.redraw();
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].settings(id, changes).then(() => this.listChanged());
  }
  accept(id) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].accept(id).then(() => {
      const c = this.conv(id);
      if (c) c.summary.request = false;
      this.requests = Math.max(0, this.requests - 1);
      this.listChanged();
      this.beat();
    });
  }

  /** Pin or unpin a message for everyone in the conversation. */
  pin(messageId, on) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].pin(messageId, on).then(r => {
      this.changed(r.message);
      const c = this.conv(r.message.conversationId);
      if (c) {
        c.summary.pinCount = Math.max(0, (c.summary.pinCount || 0) + (on ? 1 : -1));
        c.pins = null;
      }
    });
  }
  forward(messageId, conversationIds) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].forward(messageId, conversationIds).then(r => {
      r.messages.forEach(msg => this.received(msg));
      return r.messages;
    });
  }

  /** A new group: drawn and opened as soon as the server has it. */
  createGroup(userIds, name) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].createGroup(userIds, name).then(r => {
      this.ensure(r.conversation, r.messages);
      this.listChanged();
      this.show(r.conversation.id);
      return r.conversation;
    });
  }

  /** After a group change: the new summary and member list. */
  groupChanged(r) {
    if (!r || r.left) return;
    const c = this.conv(r.conversation.id);
    if (c) c.summary = {
      ...c.summary,
      ...r.conversation
    };
    if (r.members) this.members[r.conversation.id] = r.members;
    this.listChanged();
  }
  leaveGroup(id) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].removeMember(id, this.me.id()).then(() => this.forget(id));
  }
  edit(messageId, body) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].edit(messageId, body).then(r => this.changed(r.message));
  }
  remove(messageId) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].remove(messageId).then(r => this.changed(r.message));
  }
  react(messageId, emoji) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].react(messageId, emoji).then(r => this.changed(r.message));
  }
  typing(id) {
    this.touchRoom(id);
    const now = Date.now();
    if (now - (this.lastTypingSent[id] || 0) < TYPING_SEND_EVERY) return;
    this.lastTypingSent[id] = now;
    if (this.socketUp()) _api__WEBPACK_IMPORTED_MODULE_1__["default"].action(id, 'typing');
  }
  markRead(id) {
    const c = this.conv(id);
    const sent = c ? c.messages.filter(x => !x.pending) : [];
    if (!c || !sent.length || !this.isVisible(id)) return;
    const last = sent[sent.length - 1].id;
    this.unread[id] = 0;
    if ((c.summary.lastReadMessageId || 0) >= last) return;
    c.summary.lastReadMessageId = last;
    _api__WEBPACK_IMPORTED_MODULE_1__["default"].action(id, 'read', {
      messageId: last
    });
  }
  hide(id) {
    _api__WEBPACK_IMPORTED_MODULE_1__["default"].action(id, 'hide');
    this.close(id);
    this.listChanged();
  }

  // ── People ────────────────────────────────────────────────────────────────

  search(q) {
    this.filter = q;
    clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.found = [];
      return;
    }
    this.searchTimer = setTimeout(() => {
      _api__WEBPACK_IMPORTED_MODULE_1__["default"].people(q.trim()).then(r => {
        if (this.filter === q) {
          this.found = r.people || [];
          m.redraw();
        }
      });
    }, 250);
  }
  follow(userId, on) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].person(userId, 'follow', on).then(() => this.beat());
  }
  block(userId, on) {
    return _api__WEBPACK_IMPORTED_MODULE_1__["default"].person(userId, 'block', on).then(() => {
      this.beat();
      [...this.convs.values()].filter(c => !c.summary.isGroup && c.summary.participants.some(p => p.id === Number(userId))).forEach(c => this.close(c.summary.id));
    });
  }
  person(userId) {
    userId = Number(userId);
    return this.online.find(p => p.id === userId) || this.followingOffline.find(p => p.id === userId) || [...this.convs.values()].flatMap(c => c.summary.participants).find(p => p.id === userId);
  }

  /** Live presence for someone in a conversation, from the latest heartbeat. */
  presenceOf(userId) {
    const p = this.online.find(x => x.id === Number(userId));
    if (p) return p;
    const f = this.followingOffline.find(x => x.id === Number(userId));
    return f || {
      status: 'offline',
      activity: null
    };
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }
  railDocked() {
    return !this.railHidden && window.innerWidth >= DOCK_BREAKPOINT;
  }
  toggleRail() {
    if (window.innerWidth < DOCK_BREAKPOINT) {
      this.railSheet = !this.railSheet;
    } else {
      this.railHidden = !this.railHidden;
      this.fit();
      this.save();
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  key() {
    return 'parley:ui:' + (this.me ? this.me.id() : 'guest');
  }
  save() {
    try {
      localStorage.setItem(this.key(), JSON.stringify({
        open: this.open,
        heads: this.heads,
        min: [...this.minimised],
        railHidden: this.railHidden,
        expanded: [...this.expanded]
      }));
    } catch (e) {
      // Private windows refuse storage; Parley works without it.
    }
  }
  restore() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key()) || '{}');
      this.open = (s.open || []).map(Number);
      this.heads = (s.heads || []).map(Number);
      this.minimised = new Set((s.min || []).map(Number));
      this.railHidden = !!s.railHidden;
      this.expanded = new Set((s.expanded || []).map(Number));
    } catch (e) {
      // Nothing saved, or storage refused.
    }
  }
}

/** A random id for one send, so a retry is recognised as the same message. */
function nonce() {
  const bytes = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/***/ },

/***/ "./src/forum/util.js"
/*!***************************!*\
  !*** ./src/forum/util.js ***!
  \***************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GAP_MINUTES: () => (/* binding */ GAP_MINUTES),
/* harmony export */   breaks: () => (/* binding */ breaks),
/* harmony export */   clock: () => (/* binding */ clock),
/* harmony export */   hue: () => (/* binding */ hue),
/* harmony export */   initials: () => (/* binding */ initials),
/* harmony export */   linkParts: () => (/* binding */ linkParts),
/* harmony export */   mentionParts: () => (/* binding */ mentionParts),
/* harmony export */   needsDivider: () => (/* binding */ needsDivider),
/* harmony export */   placeFromPath: () => (/* binding */ placeFromPath),
/* harmony export */   readableOn: () => (/* binding */ readableOn),
/* harmony export */   runPosition: () => (/* binding */ runPosition),
/* harmony export */   tally: () => (/* binding */ tally),
/* harmony export */   windowsThatFit: () => (/* binding */ windowsThatFit)
/* harmony export */ });
/*
 * Pure helpers. No `app`, no Mithril — so the unit tests can import them
 * without a forum around them.
 */

/** A stable hue per name, the same one the mockup gives each initials circle. */
function hue(name) {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function initials(name) {
  const words = String(name || '?').replace(/[^\p{L}\p{N} _]/gu, '').split(/[ _]/).filter(Boolean).slice(0, 2);
  return (words.map(w => w[0]).join('') || String(name || '?')[0] || '?').toUpperCase();
}
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Split text into plain strings and {url} parts, in order. */
function linkParts(text) {
  const out = [];
  let last = 0;
  String(text).replace(URL_RE, (url, at) => {
    if (at > last) out.push(text.slice(last, at));
    out.push({
      url
    });
    last = at + url.length;
    return url;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Where a message sits in a run from the same sender, which decides which
 * corners of its bubble are tucked: first | mid | last | single.
 */
function runPosition(messages, i) {
  const m = messages[i];
  const own = x => x.type !== 'call' && x.type !== 'system';
  const same = o => o && own(o) && own(m) && o.userId === m.userId && !!o.pending === !!m.pending && !breaks(o, m);
  const prev = same(messages[i - 1]) && messages[i - 1];
  const next = same(messages[i + 1]) && messages[i + 1];
  if (prev && next) return 'mid';
  if (prev) return 'last';
  if (next) return 'first';
  return 'single';
}

/** A gap long enough to start a new run, and to draw a time divider. */
const GAP_MINUTES = 30;
function breaks(a, b) {
  return Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) > GAP_MINUTES * 60000;
}

/** Whether message i needs a time divider above it. */
function needsDivider(messages, i) {
  if (i === 0) return true;
  const a = new Date(messages[i - 1].createdAt);
  const b = new Date(messages[i].createdAt);
  return a.toDateString() !== b.toDateString() || breaks(messages[i - 1], messages[i]);
}

/** The mockup's 12:41 — the time in 24-hour form, as a clock reads it. */
function clock(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** Count reactions per emoji, keeping the order they first appeared. */
function tally(reactions) {
  const out = new Map();
  for (const r of reactions || []) out.set(r.emoji, (out.get(r.emoji) || 0) + 1);
  return [...out.entries()];
}

/**
 * Where the visitor is, read from the URL. The path is the one thing that is
 * always right: Flarum rewrites it as you scroll a discussion, so `near`
 * follows the reader without any hook into the post stream.
 */
function placeFromPath(path) {
  let m;
  if (m = path.match(/^\/d\/(\d+)(?:-[^/]*)?(?:\/(\d+))?/)) {
    return {
      place: 'discussion',
      discussionId: Number(m[1]),
      near: m[2] ? Number(m[2]) : null
    };
  }
  if (m = path.match(/^\/t\/([^/?#]+)/)) return {
    place: 'tag',
    tagSlug: decodeURIComponent(m[1])
  };
  if (/^\/parley(\/|$)/.test(path)) return {
    place: 'messages'
  };
  if (/^\/u\//.test(path)) return {
    place: 'user'
  };
  if (path === '/' || path === '' || /^\/all\b/.test(path)) return {
    place: 'index'
  };
  return {
    place: 'other'
  };
}

/** How many docked windows fit beside the rail before the rest become heads. */
function windowsThatFit(viewportWidth, railWidth) {
  const free = viewportWidth - railWidth - 32;
  return Math.max(1, Math.min(3, Math.floor((free + 12) / 340)));
}
const MENTION_RE = /(^|[^\w@])@([A-Za-z0-9_\-.]{2,30})/g;

/** Split plain text into strings and {username} parts for @mentions. */
function mentionParts(text) {
  const out = [];
  let last = 0;
  String(text).replace(MENTION_RE, (match, lead, username, at) => {
    const start = at + lead.length;
    if (start > last) out.push(text.slice(last, start));
    out.push({
      username
    });
    last = start + 1 + username.length;
    return match;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * White or near-black, whichever reads better on this background, by WCAG
 * relative luminance. A tag colour can be anything from navy to gold.
 */
function readableOn(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#ffffff';
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const lin = i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // #171b24 is Parley's own ink colour.
  const ink = 0.0107;
  return contrast(L, 1) >= contrast(L, ink) ? '#ffffff' : '#171b24';
}

/***/ },

/***/ "flarum/common/Component"
/*!*************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/Component')" ***!
  \*************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/Component');

/***/ },

/***/ "flarum/common/components/Button"
/*!*********************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/Button')" ***!
  \*********************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/Button');

/***/ },

/***/ "flarum/common/components/Dropdown"
/*!***********************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/Dropdown')" ***!
  \***********************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/Dropdown');

/***/ },

/***/ "flarum/common/components/FormModal"
/*!************************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/FormModal')" ***!
  \************************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/FormModal');

/***/ },

/***/ "flarum/common/components/Icon"
/*!*******************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/Icon')" ***!
  \*******************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/Icon');

/***/ },

/***/ "flarum/common/components/LoadingIndicator"
/*!*******************************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/LoadingIndicator')" ***!
  \*******************************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/LoadingIndicator');

/***/ },

/***/ "flarum/common/components/Page"
/*!*******************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/Page')" ***!
  \*******************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/Page');

/***/ },

/***/ "flarum/common/components/Separator"
/*!************************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/components/Separator')" ***!
  \************************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/components/Separator');

/***/ },

/***/ "flarum/common/extend"
/*!**********************************************************!*\
  !*** external "flarum.reg.get('core', 'common/extend')" ***!
  \**********************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/extend');

/***/ },

/***/ "flarum/common/utils/ItemList"
/*!******************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/utils/ItemList')" ***!
  \******************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/utils/ItemList');

/***/ },

/***/ "flarum/common/utils/extractText"
/*!*********************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/utils/extractText')" ***!
  \*********************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/utils/extractText');

/***/ },

/***/ "flarum/common/utils/humanTime"
/*!*******************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/utils/humanTime')" ***!
  \*******************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/utils/humanTime');

/***/ },

/***/ "flarum/common/utils/stringToColor"
/*!***********************************************************************!*\
  !*** external "flarum.reg.get('core', 'common/utils/stringToColor')" ***!
  \***********************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'common/utils/stringToColor');

/***/ },

/***/ "flarum/forum/app"
/*!******************************************************!*\
  !*** external "flarum.reg.get('core', 'forum/app')" ***!
  \******************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'forum/app');

/***/ },

/***/ "flarum/forum/components/Notification"
/*!**************************************************************************!*\
  !*** external "flarum.reg.get('core', 'forum/components/Notification')" ***!
  \**************************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'forum/components/Notification');

/***/ },

/***/ "flarum/forum/utils/UserControls"
/*!*********************************************************************!*\
  !*** external "flarum.reg.get('core', 'forum/utils/UserControls')" ***!
  \*********************************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'forum/utils/UserControls');

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		flarum.reg._webpack_runtimes["ernestdefoe-parley"] ||= __webpack_require__;// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		const getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	__webpack_require__.f = {};
/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = (chunkId) => {
/******/ 		return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 			__webpack_require__.f[key](chunkId, promises);
/******/ 			return promises;
/******/ 		}, []));
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	// This function allow to reference async chunks
/******/ 	__webpack_require__.u = (chunkId) => ({"ernestdefoe-parley:forum/components/InboxPage":"forum/components/InboxPage","ernestdefoe-parley:forum/components/ChatBody":"forum/components/ChatBody","ernestdefoe-parley:forum/components/NewConversationModal":"forum/components/NewConversationModal","ernestdefoe-parley:forum/components/ForwardModal":"forum/components/ForwardModal","ernestdefoe-parley:forum/components/EmojiPicker":"forum/components/EmojiPicker","ernestdefoe-parley:forum/components/Recorder":"forum/components/Recorder"}[chunkId] + ".js");
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	__webpack_require__.g = (function() {
/******/ 		if (typeof globalThis === 'object') return globalThis;
/******/ 		try {
/******/ 			return this || new Function('return this')();
/******/ 		} catch (e) {
/******/ 			if (typeof window === 'object') return window;
/******/ 		}
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		const inProgress = {};
/******/ 		const dataWebpackPrefix = "module.exports:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			let script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				const scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					const s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			const onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				const doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode?.removeChild(script);
/******/ 				doneFns?.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			const timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		let scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		const document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript?.tagName.toUpperCase() === 'SCRIPT')
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				const scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) {
/******/ 					let i = scripts.length - 1;
/******/ 					while (i > -1 && (!scriptUrl || !/^https?:/.test(scriptUrl))) scriptUrl = scripts[i--].src;
/******/ 				}
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/^blob:|[?#].*$/g, "").replace(/\/[^/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	__webpack_require__.f.compat = (chunkId, promises) => {
/******/ 	
/******/ 		const originalLoadChunk = __webpack_require__.l;
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => flarum.reg.loadChunk(originalLoadChunk, url, done, key, chunkId, "ernestdefoe-parley");
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		const installedChunks = {
/******/ 			"ernestdefoe-parley:forum": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				let installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							const promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							const error = new Error();
/******/ 							const loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										const errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										const realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										error.event = event;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(__webpack_require__.p + __webpack_require__.u(chunkId), loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		const webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			let [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		const chunkLoadingGlobal = self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!******************!*\
  !*** ./forum.js ***!
  \******************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Avatar: () => (/* reexport safe */ _src_forum__WEBPACK_IMPORTED_MODULE_0__.Avatar),
/* harmony export */   ChatWindow: () => (/* reexport safe */ _src_forum__WEBPACK_IMPORTED_MODULE_0__.ChatWindow),
/* harmony export */   Icons: () => (/* reexport safe */ _src_forum__WEBPACK_IMPORTED_MODULE_0__.Icons),
/* harmony export */   ParleyState: () => (/* reexport safe */ _src_forum__WEBPACK_IMPORTED_MODULE_0__.ParleyState),
/* harmony export */   PersonRow: () => (/* reexport safe */ _src_forum__WEBPACK_IMPORTED_MODULE_0__.PersonRow)
/* harmony export */ });
/* harmony import */ var _src_forum__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./src/forum */ "./src/forum/index.js");

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=forum.js.map