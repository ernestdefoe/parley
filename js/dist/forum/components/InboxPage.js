"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/InboxPage"],{

/***/ "./src/forum/components/Details.js"
/*!*****************************************!*\
  !*** ./src/forum/components/Details.js ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Details)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/components/LoadingIndicator */ "flarum/common/components/LoadingIndicator");
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! flarum/common/utils/humanTime */ "flarum/common/utils/humanTime");
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");
/* harmony import */ var _activity__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./activity */ "./src/forum/components/activity.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");












const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.details.' + key, params);
const TABS = ['media', 'files', 'links', 'pins'];

/**
 * The details column beside a conversation: who it is with, quick actions,
 * the members of a group, and what has been shared in it, a tab at a time.
 * Part of the messages page's chunk, loaded with it.
 */
class Details extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.tab = 'media';
    this.tabs = {};
    this.renaming = false;
    this.load(this.tab);
  }
  load(tab, more) {
    if (more === void 0) {
      more = false;
    }
    const id = this.attrs.id;
    const state = this.tabs[tab] ||= {
      items: [],
      hasMore: false,
      loading: true
    };
    state.loading = true;
    const before = more && state.items.length ? state.items[state.items.length - 1].id : null;
    _api__WEBPACK_IMPORTED_MODULE_9__["default"].details(id, tab, before).then(r => {
      if (r.members) (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).members[id] = r.members;
      state.items = more ? [...state.items, ...r.items] : r.items;
      state.hasMore = r.hasMore;
      state.loading = false;
      m.redraw();
    });
  }
  view() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const id = this.attrs.id;
    const conv = s.conv(id);
    if (!conv) return m("aside", {
      className: "pl-details"
    });
    const summary = conv.summary;
    const isRoom = summary.type === 'room';
    const room = isRoom ? {
      ...(summary.room || {}),
      ...(s.room(id) || {})
    } : null;
    const peer = summary.participants[0] || {};
    const members = s.members[id];
    const owner = summary.role === 'owner';
    return m("aside", {
      className: "pl-details",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('label'))
    }, m("div", {
      className: "pl-details-head"
    }, m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--icon Button--flat pl-details-close",
      icon: "fas fa-times",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('close')),
      onclick: this.attrs.onclose
    }), m("div", {
      className: "pl-details-face"
    }, isRoom ? (0,_RoomTile__WEBPACK_IMPORTED_MODULE_7__["default"])(room, 88) : (0,_Avatar__WEBPACK_IMPORTED_MODULE_6__.Face)(summary, 88, s.presenceOf.bind(s)), summary.isGroup ? m("label", {
      className: "pl-photo-edit",
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('change_photo'))
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].camera(), m("span", {
      className: "visually-hidden"
    }, t('change_photo')), m("input", {
      type: "file",
      accept: "image/png,image/jpeg,image/webp,image/gif",
      hidden: true,
      onchange: e => this.photo(e)
    })) : null), this.renaming ? m("form", {
      className: "pl-rename",
      onsubmit: e => this.rename(e)
    }, m("input", {
      className: "FormControl",
      maxlength: "80",
      value: this.name,
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('group_name')),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('group_name')),
      oncreate: v => v.dom.focus(),
      oninput: e => this.name = e.target.value
    }), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      type: "submit",
      className: "Button Button--primary"
    }, t('save'))) : m("h3", null, isRoom ? room.name : (0,_labels__WEBPACK_IMPORTED_MODULE_11__.convTitle)(summary), summary.isGroup ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--icon Button--flat",
      icon: "fas fa-pencil-alt",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('rename')),
      onclick: () => {
        this.renaming = true;
        this.name = summary.title || '';
      }
    }) : null), m("p", {
      className: "pl-details-sub"
    }, isRoom ? room.description || '' : summary.isGroup ? flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.members_count', {
      count: summary.memberCount
    }) : (0,_activity__WEBPACK_IMPORTED_MODULE_10__.presenceLine)({
      ...peer,
      ...s.presenceOf(peer.id)
    })), summary.isGroup && summary.imageUrl ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--link",
      onclick: () => _api__WEBPACK_IMPORTED_MODULE_9__["default"].groupPhoto(id, null).then(r => s.groupChanged(r))
    }, t('remove_photo')) : null), !isRoom ? m("div", {
      className: "pl-details-actions"
    }, m("button", {
      onclick: () => s.file(id, {
        muted: !summary.muted
      }),
      "aria-pressed": String(!!summary.muted)
    }, summary.muted ? _icons__WEBPACK_IMPORTED_MODULE_8__["default"].bell() : _icons__WEBPACK_IMPORTED_MODULE_8__["default"].muted(), m("span", null, summary.muted ? t('unmute') : t('mute'))), m("button", {
      onclick: () => this.findInChat()
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].search(), m("span", null, t('search'))), m("button", {
      onclick: () => this.switchTab('pins')
    }, _icons__WEBPACK_IMPORTED_MODULE_8__["default"].pin(), m("span", null, t('pins'))), !summary.isGroup && peer.slug ? m("a", {
      href: flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('user', {
        username: peer.slug
      })
    }, m("i", {
      className: "icon fas fa-user",
      "aria-hidden": "true"
    }), m("span", null, t('profile'))) : null) : null, summary.isGroup ? m("section", {
      className: "pl-members"
    }, m("h4", null, t('members'), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--link",
      icon: "fas fa-user-plus",
      onclick: () => this.addPeople()
    }, t('add_people'))), !members ? m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default()), {
      size: "small"
    }) : members.map(p => m("div", {
      className: "pl-member"
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_6__["default"])(p, 32, {
      dot: true,
      status: p.online ? s.presenceOf(p.id).status || 'online' : 'offline'
    }), m("span", {
      className: "pl-member-nm"
    }, p.displayName, p.role === 'owner' ? m("span", {
      className: "pl-member-role"
    }, t('owner')) : null), owner && p.id !== Number(s.me.id()) ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--icon Button--flat",
      icon: "fas fa-user-minus",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('remove', {
        name: p.displayName
      })),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('remove', {
        name: p.displayName
      })),
      onclick: () => confirm(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('remove_confirm', {
        name: p.displayName
      }))) && _api__WEBPACK_IMPORTED_MODULE_9__["default"].removeMember(id, p.id).then(r => s.groupChanged(r))
    }) : null)), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--block pl-leave",
      icon: "fas fa-sign-out-alt",
      onclick: () => confirm(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_5___default()(t('leave_confirm'))) && s.leaveGroup(id)
    }, t('leave'))) : null, m("section", {
      className: "pl-shared"
    }, m("div", {
      className: "pl-tabs",
      role: "tablist"
    }, TABS.map(tab => m("button", {
      role: "tab",
      "aria-selected": String(this.tab === tab),
      className: this.tab === tab ? 'active' : '',
      onclick: () => this.switchTab(tab)
    }, t('tab_' + tab)))), this.tabBody(conv)));
  }
  switchTab(tab) {
    this.tab = tab;
    if (!this.tabs[tab] || tab === 'pins') this.load(tab);
  }
  tabBody(conv) {
    const state = this.tabs[this.tab];
    if (!state || state.loading && !state.items.length) return m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default()), {
      size: "small"
    });
    if (!state.items.length) return m("p", {
      className: "pl-list-empty"
    }, t('none_' + this.tab));
    const open = msg => {
      if (conv.messages.some(x => x.id === msg.id)) {
        conv.jumpTo = msg.id;
      } else {
        flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.load(conv.summary.id, {
          around: msg.id
        });
      }
    };
    const items = this.tab === 'media' ? m("div", {
      className: "pl-media-grid"
    }, state.items.map(msg => m("a", {
      href: _api__WEBPACK_IMPORTED_MODULE_9__["default"].fileUrl(msg.id),
      target: "_blank",
      rel: "noopener",
      className: "pl-media-cell"
    }, msg.type === 'video' ? m("span", {
      className: "pl-media-video"
    }, m("i", {
      className: "fas fa-play",
      "aria-hidden": "true"
    })) : m("img", {
      src: _api__WEBPACK_IMPORTED_MODULE_9__["default"].fileUrl(msg.id),
      alt: "",
      loading: "lazy"
    })))) : state.items.map(msg => m("button", {
      className: "pl-shared-row",
      onclick: () => open(msg)
    }, m("span", {
      className: "pl-shared-icon"
    }, this.tab === 'links' ? _icons__WEBPACK_IMPORTED_MODULE_8__["default"].link() : this.tab === 'pins' ? _icons__WEBPACK_IMPORTED_MODULE_8__["default"].pin() : msg.type === 'voice' ? _icons__WEBPACK_IMPORTED_MODULE_8__["default"].mic() : _icons__WEBPACK_IMPORTED_MODULE_8__["default"].file()), m("span", {
      className: "pl-shared-text"
    }, m("span", null, this.tab === 'links' ? (msg.body.match(/https?:\/\/\S+/) || [msg.body])[0] : msg.type === 'voice' ? (0,_labels__WEBPACK_IMPORTED_MODULE_11__.duration)((msg.meta || {}).duration) : (0,_labels__WEBPACK_IMPORTED_MODULE_11__.messagePreview)(msg)), m("small", null, msg.author ? msg.author.displayName + ' · ' : '', flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_4___default()(msg.createdAt), msg.type === 'file' ? ' · ' + (0,_labels__WEBPACK_IMPORTED_MODULE_11__.fileSize)((msg.meta || {}).size) : ''))));
    return [items, state.hasMore ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--block",
      onclick: () => this.load(this.tab, true)
    }, t('more')) : null];
  }
  findInChat() {
    // The header's own search button: one search, one place.
    document.querySelector('.pl-win.page [data-item="search"]')?.click();
  }
  addPeople() {
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().modal.show(() => __webpack_require__.e(/*! import() | forum/components/NewConversationModal */ "ernestdefoe-parley:forum/components/NewConversationModal").then(() => (__webpack_require__(/*! ./NewConversationModal */ "./src/forum/components/NewConversationModal.js"))), {
      conversationId: this.attrs.id,
      members: (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).members[this.attrs.id] || []
    });
  }
  rename(e) {
    e.preventDefault();
    _api__WEBPACK_IMPORTED_MODULE_9__["default"].renameGroup(this.attrs.id, this.name).then(r => {
      this.renaming = false;
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.groupChanged(r);
    });
  }
  photo(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) _api__WEBPACK_IMPORTED_MODULE_9__["default"].groupPhoto(this.attrs.id, file).then(r => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.groupChanged(r));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Details', Details);flarum.reg.addChunkModule('ernestdefoe-parley:forum/components/NewConversationModal', './src/forum/components/NewConversationModal.js', 'ernestdefoe-parley', 'forum/components/NewConversationModal');

/***/ },

/***/ "./src/forum/components/InboxPage.js"
/*!*******************************************!*\
  !*** ./src/forum/components/InboxPage.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InboxPage)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/components/Page */ "flarum/common/components/Page");
/* harmony import */ var flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/LoadingIndicator */ "flarum/common/components/LoadingIndicator");
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_components_Dropdown__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/components/Dropdown */ "flarum/common/components/Dropdown");
/* harmony import */ var flarum_common_components_Dropdown__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Dropdown__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! flarum/common/components/Separator */ "flarum/common/components/Separator");
/* harmony import */ var flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! flarum/common/utils/humanTime */ "flarum/common/utils/humanTime");
/* harmony import */ var flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _ChatWindow__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./ChatWindow */ "./src/forum/components/ChatWindow.js");
/* harmony import */ var _Details__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./Details */ "./src/forum/components/Details.js");
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../util */ "./src/forum/util.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");
















const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.inbox.' + key, params);
const tw = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);
const MORE = ['mentions', 'pinned', 'starred', 'muted', 'archived', 'requests'];

/**
 * /parley — the messenger. Conversations down the left, the open one in the
 * middle, its details on the right when asked for. On a phone the list and
 * the conversation are two screens, each the full width.
 *
 * Loaded when someone first comes here; nothing of it is on other pages.
 */
class InboxPage extends (flarum_common_components_Page__WEBPACK_IMPORTED_MODULE_1___default()) {
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
    this.details = saved === null ? window.innerWidth >= 1600 : saved === '1';
    this.selected = Number(m.route.param('id')) || null;
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().setTitle(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('title')));
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().setTitleCount(0);
    if (!(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley)) return;
    (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).pageConversation = this.selected;
    if (this.selected) {
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.touchRoom(this.selected);
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.select(this.selected);
    }
    this.seenVersion = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).listVersion || 0;
    this.fetch('all');
  }
  onbeforeupdate(vnode) {
    super.onbeforeupdate(vnode);
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
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
    if ((flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley)) (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).pageConversation = null;
  }
  fetch(filter, quiet, more) {
    if (quiet === void 0) {
      quiet = false;
    }
    if (more === void 0) {
      more = false;
    }
    const list = this.lists[filter] ||= {
      items: [],
      hasMore: false,
      loading: true
    };
    if (!quiet) list.loading = true;
    const offset = more ? list.items.length : 0;
    return _api__WEBPACK_IMPORTED_MODULE_13__["default"].conversations(filter, offset).then(r => {
      r.conversations.forEach(c => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.ensure(c));
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
    if (!this.lists[filter]) this.fetch(filter);else this.fetch(filter, true);
  }
  view() {
    if (!(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley)) {
      return m("div", {
        className: "ParleyPage"
      }, m("div", {
        className: "container"
      }, m("p", {
        className: "pl-guests"
      }, t('no_access'))));
    }
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const open = this.selected && s.conv(this.selected);
    const showDetails = this.details && open;
    return m("div", {
      className: "ParleyPage"
    }, m("div", {
      className: "container"
    }, m("div", {
      className: 'Parley pl-messenger' + (this.selected ? ' has-selected' : '') + (showDetails ? ' has-details' : '')
    }, m("aside", {
      className: "pl-list"
    }, this.listColumn()), m("main", {
      className: "pl-chat"
    }, this.selected ? m(_ChatWindow__WEBPACK_IMPORTED_MODULE_10__["default"], {
      key: this.selected,
      id: this.selected,
      page: true,
      detailsOpen: showDetails,
      ondetails: () => this.toggleDetails(),
      onback: () => m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.inbox'))
    }) : m("div", {
      className: "pl-pick"
    }, _icons__WEBPACK_IMPORTED_MODULE_12__["default"].msg(), m("p", null, t('pick')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      className: "Button Button--primary",
      icon: "fas fa-pen-to-square",
      onclick: () => this.compose()
    }, t('new_message')))), m("div", {
      className: "pl-details-slot"
    }, showDetails ? m(_Details__WEBPACK_IMPORTED_MODULE_11__["default"], {
      key: 'd' + this.selected,
      id: this.selected,
      onclose: () => this.toggleDetails()
    }) : null))));
  }
  toggleDetails() {
    this.details = !this.details;
    try {
      localStorage.setItem('parley:details', this.details ? '1' : '0');
    } catch (e) {
      // Remembered for the page only.
    }
  }
  compose(members) {
    if (members === void 0) {
      members = null;
    }
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().modal.show(() => __webpack_require__.e(/*! import() | forum/components/NewConversationModal */ "ernestdefoe-parley:forum/components/NewConversationModal").then(() => (__webpack_require__(/*! ./NewConversationModal */ "./src/forum/components/NewConversationModal.js"))), members ? {
      conversationId: this.selected,
      members
    } : {});
  }

  // ── The list column ───────────────────────────────────────────────────────

  listColumn() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const moreActive = MORE.includes(this.filter) || this.filter === 'reports';
    return [m("div", {
      className: "pl-list-head"
    }, m("h2", null, t('title')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      className: "Button Button--icon Button--flat",
      icon: "fas fa-pen-to-square",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('new_message')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('new_message')),
      onclick: () => this.compose()
    })), m("form", {
      className: "pl-list-search",
      role: "search",
      onsubmit: e => this.searchMessages(e)
    }, _icons__WEBPACK_IMPORTED_MODULE_12__["default"].search(), m("input", {
      className: "FormControl",
      type: "search",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('search')),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('search')),
      value: this.query,
      oninput: e => {
        this.query = e.target.value;
        if (!this.query.trim()) this.found = null;
      }
    })), m("div", {
      className: "pl-filters",
      role: "tablist"
    }, ['all', 'unread', 'groups'].map(f => m("button", {
      role: "tab",
      className: 'pl-pill' + (this.filter === f ? ' active' : ''),
      "aria-selected": String(this.filter === f),
      onclick: () => this.setFilter(f)
    }, t('filter_' + f))), m((flarum_common_components_Dropdown__WEBPACK_IMPORTED_MODULE_3___default()), {
      className: "pl-more-filter",
      buttonClassName: 'pl-pill' + (moreActive ? ' active' : ''),
      label: [moreActive ? t('filter_' + this.filter) : t('more'), s.requests && this.filter !== 'requests' ? m("span", {
        className: "pl-dotcount"
      }, s.requests) : null],
      caretIcon: "fas fa-caret-down",
      accessibleToggleLabel: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('more'))
    }, MORE.map(f => m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: moreIcon(f),
      active: this.filter === f,
      onclick: () => this.setFilter(f)
    }, t('filter_' + f), f === 'requests' && s.requests ? m("span", {
      className: "pl-count"
    }, s.requests) : null)), s.config.canModerate ? m((flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5___default()), null) : null, s.config.canModerate ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: "fas fa-flag",
      active: this.filter === 'reports',
      onclick: () => this.setFilter('reports')
    }, t('reports')) : null)), m("div", {
      className: "pl-list-scroll"
    }, this.listBody())];
  }
  listBody() {
    if (this.filter === 'reports') return this.reportsList();
    if (this.found) return this.searchResults();
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const list = this.lists[this.filter];
    if (!list || list.loading && !list.items.length) return m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2___default()), null);
    const q = this.query.trim().toLowerCase();
    // What the list holds, with each conversation as this page knows it now.
    const items = list.items.map(c => s.conv(c.id)?.summary || c).filter(c => this.stillBelongs(c)).filter(c => !q || (0,_labels__WEBPACK_IMPORTED_MODULE_15__.convTitle)(c).toLowerCase().includes(q) || (c.participants || []).some(p => p.username.toLowerCase().includes(q))).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    return [this.filter === 'all' && !q ? this.roomsList() : null, this.filter === 'all' && !q && s.rooms.length ? m("div", {
      className: "pl-list-sec"
    }, t('direct')) : null, this.filter === 'requests' && items.length ? m("p", {
      className: "pl-list-note"
    }, t('requests_note')) : null, items.length ? items.map(c => this.item(c)) : m("p", {
      className: "pl-list-empty"
    }, q ? t('no_matches') : t('empty_' + this.filter)), q.length >= 2 ? m("button", {
      className: "pl-search-all",
      onclick: e => this.searchMessages(e)
    }, _icons__WEBPACK_IMPORTED_MODULE_12__["default"].search(), " ", t('search_messages_for', {
      q: this.query.trim()
    })) : null, list.hasMore && !q ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      className: "Button Button--block pl-load-more",
      onclick: () => this.fetch(this.filter, true, true)
    }, t('load_more')) : null];
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
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    if (!s.rooms.length) return null;
    return [m("div", {
      className: "pl-list-sec"
    }, t('rooms')),
    // Conferences, then the team rooms you have joined, each under its own.
    s.rooms.filter(r => !r.parentId).flatMap(p => [p, ...s.rooms.filter(c => c.parentId === p.id)]).map(r => m("a", {
      className: 'pl-item' + (r.parentId ? ' child' : '') + (r.id === this.selected ? ' active' : '') + (r.unread ? ' unread' : ''),
      href: flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
        id: r.id
      }),
      onclick: e => {
        e.preventDefault();
        const go = () => m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
          id: r.id
        }));
        r.joined ? go() : flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.openRoom(r.id).then(go);
      }
    }, (0,_RoomTile__WEBPACK_IMPORTED_MODULE_9__["default"])(r, 44), m("span", {
      className: "pl-info"
    }, m("span", {
      className: "pl-nm"
    }, r.name), m("span", {
      className: "pl-act"
    }, r.online ? flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.online_count', {
      count: r.online
    }) : r.description || flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.rooms.members_count', {
      count: r.members
    }))), m("span", {
      className: "pl-meta"
    }, r.unread ? m("span", {
      className: "pl-unread"
    }, r.unread > 99 ? '99+' : r.unread) : null)))];
  }
  item(c) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const last = c.lastMessage;
    const mine = last && last.userId === Number(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id());
    const unread = s.unread[c.id] ?? c.unread ?? 0;
    const draft = c.id !== this.selected && s.drafts[c.id];
    const when = last ? new Date(last.createdAt).toDateString() === new Date().toDateString() ? (0,_util__WEBPACK_IMPORTED_MODULE_14__.clock)(last.createdAt) : flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6___default()(last.createdAt) : '';
    return m("div", {
      className: 'pl-item' + (c.id === this.selected ? ' active' : '') + (unread ? ' unread' : '') + (c.muted ? ' muted' : '')
    }, m("a", {
      className: "pl-item-link",
      href: flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
        id: c.id
      }),
      onclick: e => {
        e.preventDefault();
        m.route.set(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
          id: c.id
        }));
      }
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_8__.Face)(c, 46, s.presenceOf.bind(s)), m("span", {
      className: "pl-info"
    }, m("span", {
      className: "pl-nm"
    }, c.label ? m("i", {
      className: 'pl-label pl-label--' + c.label,
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('label_' + c.label))
    }) : null, m("span", null, (0,_labels__WEBPACK_IMPORTED_MODULE_15__.convTitle)(c)), c.starred ? m("span", {
      className: "pl-flag"
    }, _icons__WEBPACK_IMPORTED_MODULE_12__["default"].star()) : null, c.muted ? m("span", {
      className: "pl-flag"
    }, _icons__WEBPACK_IMPORTED_MODULE_12__["default"].muted()) : null), m("span", {
      className: "pl-act"
    }, draft ? [m("b", {
      className: "pl-draft"
    }, t('draft')), ' ', draft] : [c.mentioned ? m("b", {
      className: "pl-at"
    }, "@ ") : null, mine && last.type !== 'system' ? [t('you'), ': '] : null, (0,_labels__WEBPACK_IMPORTED_MODULE_15__.messagePreview)(last)])), m("span", {
      className: "pl-meta"
    }, m("span", {
      className: "pl-when"
    }, when), unread ? m("span", {
      className: "pl-unread"
    }, unread > 99 ? '99+' : unread) : null)), c.type !== 'room' ? this.itemMenu(c) : null);
  }
  itemMenu(c) {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const labels = s.config.labels || [];
    return m((flarum_common_components_Dropdown__WEBPACK_IMPORTED_MODULE_3___default()), {
      className: "pl-item-menu",
      buttonClassName: "Button Button--icon Button--flat",
      icon: "fas fa-ellipsis-h",
      label: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('options')),
      accessibleToggleLabel: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('options')),
      menuClassName: "Dropdown-menu--right"
    }, c.request ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: "fas fa-check",
      onclick: () => s.accept(c.id)
    }, tw('accept')) : null, m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: c.starred ? 'far fa-star' : 'fas fa-star',
      onclick: () => s.file(c.id, {
        starred: !c.starred
      })
    }, c.starred ? t('unstar') : t('star')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: c.muted ? 'fas fa-bell' : 'fas fa-bell-slash',
      onclick: () => s.file(c.id, {
        muted: !c.muted
      })
    }, c.muted ? t('unmute') : t('mute')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: "fas fa-archive",
      onclick: () => s.file(c.id, {
        archived: !c.archived
      })
    }, c.archived ? t('unarchive') : t('archive')), m((flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5___default()), null), m("div", {
      className: "pl-label-pick",
      role: "group",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('label'))
    }, labels.map(l => m("button", {
      className: 'pl-label pl-label--' + l + (c.label === l ? ' on' : ''),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('label_' + l)),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('label_' + l)),
      "aria-pressed": String(c.label === l),
      onclick: () => s.file(c.id, {
        label: c.label === l ? null : l
      })
    }))), m((flarum_common_components_Separator__WEBPACK_IMPORTED_MODULE_5___default()), null), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      icon: "far fa-trash-alt",
      onclick: () => s.hide(c.id)
    }, t('delete')));
  }

  // ── Searching messages ────────────────────────────────────────────────────

  searchMessages(e, extra) {
    if (extra === void 0) {
      extra = {};
    }
    e && e.preventDefault();
    const q = this.query.trim();
    this.found = {
      ...(this.found || {}),
      ...extra,
      q,
      loading: true
    };
    const f = this.found;
    if (q.length < 2 && !f.type && !f.from && !f.since && !f.until) {
      this.found = q ? this.found : null;
      if (this.found) this.found.loading = false;
      return;
    }
    _api__WEBPACK_IMPORTED_MODULE_13__["default"].search({
      q,
      type: f.type,
      from: f.from,
      since: f.since,
      until: f.until
    }).then(r => {
      if (this.found !== f) return;
      f.loading = false;
      f.messages = r.messages;
      f.conversations = Object.fromEntries(r.conversations.map(c => [c.id, c]));
      m.redraw();
    });
  }
  searchResults() {
    const f = this.found;
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    // Everyone this page knows, to search by.
    const people = new Map();
    [...s.convs.values()].forEach(c => (c.summary.participants || []).forEach(p => people.set(p.id, p)));
    return [m("div", {
      className: "pl-search-filters"
    }, m("select", {
      className: "FormControl",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('search_type')),
      value: f.type || '',
      onchange: e => this.searchMessages(null, {
        type: e.target.value || null
      })
    }, m("option", {
      value: ""
    }, t('type_any')), ['text', 'media', 'voice', 'file', 'link'].map(x => m("option", {
      value: x
    }, t('type_' + x)))), m("select", {
      className: "FormControl",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_7___default()(t('search_from')),
      value: f.from || '',
      onchange: e => this.searchMessages(null, {
        from: Number(e.target.value) || null
      })
    }, m("option", {
      value: ""
    }, t('from_anyone')), m("option", {
      value: flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().session.user.id()
    }, t('from_me')), [...people.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)).map(p => m("option", {
      value: p.id
    }, p.displayName))), m("label", null, m("span", null, t('since')), m("input", {
      type: "date",
      className: "FormControl",
      value: f.since || '',
      onchange: e => this.searchMessages(null, {
        since: e.target.value || null
      })
    })), m("label", null, m("span", null, t('until')), m("input", {
      type: "date",
      className: "FormControl",
      value: f.until || '',
      onchange: e => this.searchMessages(null, {
        until: e.target.value || null
      })
    })), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      className: "Button Button--link",
      onclick: () => this.found = null
    }, t('close_search'))), f.loading ? m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2___default()), null) : !f.messages || !f.messages.length ? m("p", {
      className: "pl-list-empty"
    }, t('no_results')) : f.messages.map(msg => {
      const c = f.conversations[msg.conversationId];
      if (!c) return null;
      return m("a", {
        className: "pl-item pl-hit",
        href: flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().route('parley.conversation', {
          id: c.id
        }),
        onclick: e => {
          e.preventDefault();
          // Already open: jump in place; otherwise open it there.
          c.id === this.selected ? s.load(c.id, {
            around: msg.id
          }) : s.openAt(c.id, msg.id);
        }
      }, c.type === 'room' ? (0,_RoomTile__WEBPACK_IMPORTED_MODULE_9__["default"])(c.room || {}, 40) : (0,_Avatar__WEBPACK_IMPORTED_MODULE_8__.Face)(c, 40), m("span", {
        className: "pl-info"
      }, m("span", {
        className: "pl-nm"
      }, m("span", null, (0,_labels__WEBPACK_IMPORTED_MODULE_15__.convTitle)(c))), m("span", {
        className: "pl-act"
      }, msg.author ? m("b", null, msg.author.displayName, ": ") : null, (0,_labels__WEBPACK_IMPORTED_MODULE_15__.messagePreview)(msg))), m("span", {
        className: "pl-meta"
      }, m("span", {
        className: "pl-when"
      }, flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6___default()(msg.createdAt))));
    })];
  }

  // ── Reports, for moderators ───────────────────────────────────────────────

  openReports() {
    this.reports = null;
    _api__WEBPACK_IMPORTED_MODULE_13__["default"].reports().then(r => {
      this.reports = r.reports;
      m.redraw();
    });
  }
  reportsList() {
    if (!this.reports) return m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_2___default()), null);
    if (!this.reports.length) return m("p", {
      className: "pl-list-empty"
    }, t('no_reports'));
    return this.reports.map(r => m("div", {
      className: "pl-report-card"
    }, m("div", {
      className: "pl-report-meta"
    }, t('reported_by', {
      reporter: r.reporter?.displayName || '?',
      reported: r.reported?.displayName || '?'
    }), " \xB7 ", flarum_common_utils_humanTime__WEBPACK_IMPORTED_MODULE_6___default()(r.createdAt)), r.reason ? m("p", {
      className: "pl-report-reason"
    }, "\u201C", r.reason, "\u201D") : null, m("div", {
      className: "pl-report-snapshot"
    }, r.snapshot.map(m2 => m("div", {
      className: 'pl-snap' + (m2.reported ? ' reported' : '')
    }, m("b", null, m2.user?.displayName || '?'), " ", m("span", {
      className: "pl-when"
    }, (0,_util__WEBPACK_IMPORTED_MODULE_14__.clock)(m2.createdAt)), m("div", null, m2.body ?? (0,_labels__WEBPACK_IMPORTED_MODULE_15__.messagePreview)({
      ...m2,
      deleted: m2.body === null && m2.type === 'text'
    }))))), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_4___default()), {
      className: "Button",
      onclick: () => _api__WEBPACK_IMPORTED_MODULE_13__["default"].resolve(r.id).then(res => {
        this.reports = res.reports;
        m.redraw();
      })
    }, t('resolve'))));
  }
}
function moreIcon(filter) {
  return {
    mentions: 'fas fa-at',
    pinned: 'fas fa-thumbtack',
    starred: 'fas fa-star',
    muted: 'fas fa-bell-slash',
    archived: 'fas fa-archive',
    requests: 'fas fa-inbox'
  }[filter];
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/InboxPage', InboxPage);

/***/ }

}]);
//# sourceMappingURL=InboxPage.js.map