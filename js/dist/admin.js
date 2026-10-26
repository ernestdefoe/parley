/******/ (() => { // webpackBootstrap
/******/ 	// runtime can't be in strict mode because a global variable is assign and maybe created.
/******/ 	var __webpack_modules__ = ({

/***/ "./src/admin/components/RoomsManager.js"
/*!**********************************************!*\
  !*** ./src/admin/components/RoomsManager.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RoomsManager)
/* harmony export */ });
/* harmony import */ var flarum_admin_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/admin/app */ "flarum/admin/app");
/* harmony import */ var flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_admin_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/components/LoadingIndicator */ "flarum/common/components/LoadingIndicator");
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! flarum/common/components/Icon */ "flarum/common/components/Icon");
/* harmony import */ var flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _forum_util__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../forum/util */ "./src/forum/util.js");






const t = (key, params) => flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.admin.rooms.' + key, params);
const url = function (path) {
  if (path === void 0) {
    path = '';
  }
  return flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().forum.attribute('apiUrl') + '/parley/admin/rooms' + path;
};

/**
 * The rooms, in the order members see them. Drag a row to move it; nothing
 * here uses up and down arrows.
 */
class RoomsManager extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.rooms = null;
    this.editing = null; // a room's id, 'new', or null
    this.form = {};
    this.confirmDelete = null;
    this.dragging = null;
    this.openGroups = new Set();
    this.load();
  }
  load() {
    flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'GET',
      url: url()
    }).then(r => {
      this.rooms = r.rooms;
      m.redraw();
    });
  }
  view() {
    if (!this.rooms) return m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default()), null);
    const tags = flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().store.all('tags');
    return m("div", {
      className: "ParleyRooms"
    }, m("p", {
      className: "helpText"
    }, t('help')), m("ul", {
      className: "ParleyRooms-list"
    }, [...this.visible().map(r => m("li", {
      key: r.id,
      className: 'ParleyRooms-row' + (r.parentId ? ' child' : '') + (r.archived ? ' archived' : '') + (this.dragging === r.id ? ' dragging' : ''),
      draggable: this.editing === null ? 'true' : 'false',
      ondragstart: e => {
        this.dragging = r.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(r.id));
      },
      ondragover: e => {
        e.preventDefault();
        if (this.dragging === null || this.dragging === r.id) return;
        const from = this.rooms.findIndex(x => x.id === this.dragging);
        const to = this.rooms.findIndex(x => x.id === r.id);
        // Rooms move among their own level: a team stays under its conference.
        if ((this.rooms[from].parentId || null) !== (r.parentId || null)) return;
        const [moved] = this.rooms.splice(from, 1);
        this.rooms.splice(to, 0, moved);
      },
      ondragend: () => {
        this.dragging = null;
        const level = this.rooms.find(x => x.id === r.id)?.parentId || null;
        flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
          method: 'POST',
          url: url('/order'),
          body: {
            ids: this.rooms.filter(x => (x.parentId || null) === level).map(x => x.id)
          }
        }).then(res => {
          this.rooms = res.rooms;
          m.redraw();
        });
      }
    }, this.editing === r.id ? this.editor(tags) : [m("span", {
      className: "ParleyRooms-grip",
      "aria-hidden": "true"
    }, "\u283F"), this.tile(r), m("span", {
      className: "ParleyRooms-info"
    }, m("b", null, r.name), m("small", null, this.children(r.id).length ? [m("a", {
      href: "#",
      onclick: e => {
        e.preventDefault();
        this.openGroups.has(r.id) ? this.openGroups.delete(r.id) : this.openGroups.add(r.id);
      }
    }, t(this.openGroups.has(r.id) ? 'hide_rooms' : 'show_rooms', {
      count: this.children(r.id).length
    })), ' · '] : null, r.tagId ? t('in_tag', {
      tag: (tags.find(x => Number(x.id()) === r.tagId) || {
        name: () => '?'
      }).name()
    }) : t('everyone'), ' · ', t('members', {
      count: r.members || 0
    }), r.readonly ? [' · ', t('announcements')] : null, r.archived ? [' · ', t('archived')] : null)), m("span", {
      className: "ParleyRooms-actions"
    }, this.confirmDelete === r.id ? [m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--danger",
      onclick: () => this.remove(r)
    }, t('delete_confirm')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: () => this.confirmDelete = null
    }, t('cancel'))] : [m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: () => this.edit(r)
    }, t('edit')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      loading: this.uploading === r.id,
      onclick: e => e.currentTarget.parentNode.querySelector('input[type=file]').click()
    }, r.imageUrl ? t('replace_logo') : t('upload_logo')), m("input", {
      type: "file",
      hidden: true,
      accept: "image/png,image/jpeg,image/webp,image/gif",
      onchange: e => this.upload(r, e)
    }), r.imageUrl ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: () => this.removeImage(r)
    }, t('remove_logo')) : null, r.imageUrl ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: e => e.currentTarget.parentNode.querySelector('input.dark').click()
    }, r.imageDarkUrl && !r.imageDarkUrl.includes('-dark-auto-') ? t('replace_dark_logo') : t('upload_dark_logo')) : null, r.imageUrl ? m("input", {
      type: "file",
      className: "dark",
      hidden: true,
      accept: "image/png,image/jpeg,image/webp,image/gif",
      onchange: e => this.upload(r, e, 'dark')
    }) : null, m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: () => this.save(r, {
        archived: !r.archived
      })
    }, r.archived ? t('restore') : t('archive')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--danger",
      onclick: () => this.confirmDelete = r.id
    }, t('delete'))])])), this.editing === 'new' ? m("li", {
      key: "new",
      className: "ParleyRooms-row"
    }, this.editor(tags)) : null].filter(Boolean)), this.editing === null ? m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--primary",
      icon: "fas fa-plus",
      onclick: () => this.edit(null)
    }, t('add')) : null);
  }

  /** The same face members see: emoji, else the tag's logo on its colour, else #. */
  tile(r) {
    if (r.imageUrl) return m("span", {
      className: "ParleyRooms-tile image"
    }, m("img", {
      src: r.imageUrl,
      alt: ""
    }));
    if (r.emoji || !r.tagIcon) return m("span", {
      className: "ParleyRooms-tile"
    }, r.emoji || '#');
    return m("span", {
      className: "ParleyRooms-tile logo",
      style: r.tagColor ? {
        background: r.tagColor,
        color: (0,_forum_util__WEBPACK_IMPORTED_MODULE_5__.readableOn)(r.tagColor)
      } : {}
    }, m((flarum_common_components_Icon__WEBPACK_IMPORTED_MODULE_4___default()), {
      name: r.tagIcon
    }));
  }
  editor(tags) {
    const f = this.form;
    return m("form", {
      className: "ParleyRooms-editor",
      onsubmit: e => {
        e.preventDefault();
        this.save(this.editing === 'new' ? null : {
          id: this.editing
        }, f);
      }
    }, m("div", {
      className: "ParleyRooms-fields"
    }, m("input", {
      className: "FormControl ParleyRooms-emoji",
      id: "ParleyRooms-emoji",
      placeholder: flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.admin.rooms.emoji_placeholder'),
      title: flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.admin.rooms.emoji_help'),
      maxlength: "8",
      value: f.emoji,
      oninput: e => f.emoji = e.target.value,
      "aria-label": t('emoji')
    }), m("input", {
      className: "FormControl",
      id: "ParleyRooms-name",
      placeholder: t('name'),
      required: true,
      maxlength: "80",
      value: f.name,
      oninput: e => f.name = e.target.value,
      "aria-label": t('name')
    })), m("input", {
      className: "FormControl",
      id: "ParleyRooms-description",
      placeholder: t('description'),
      maxlength: "300",
      value: f.description,
      oninput: e => f.description = e.target.value,
      "aria-label": t('description')
    }), m("label", {
      htmlFor: "ParleyRooms-tag"
    }, t('who_sees')), m("select", {
      className: "FormControl",
      id: "ParleyRooms-tag",
      value: f.tagId || '',
      onchange: e => f.tagId = e.target.value || null
    }, m("option", {
      value: ""
    }, t('everyone')), tags.map(tag => m("option", {
      value: tag.id()
    }, t('same_as_tag', {
      tag: tag.name()
    })))), m("label", {
      htmlFor: "ParleyRooms-parent"
    }, t('parent')), m("select", {
      className: "FormControl",
      id: "ParleyRooms-parent",
      value: f.parentId || '',
      onchange: e => f.parentId = e.target.value || null
    }, m("option", {
      value: ""
    }, t('no_parent')), this.rooms.filter(r => !r.parentId && r.id !== this.editing).map(r => m("option", {
      value: r.id
    }, r.name))), m("label", {
      className: "checkbox"
    }, m("input", {
      type: "checkbox",
      id: "ParleyRooms-readonly",
      checked: !!f.readonly,
      onchange: e => f.readonly = e.target.checked
    }), " ", t('readonly')), m("div", {
      className: "ParleyRooms-actions"
    }, m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--primary",
      type: "submit"
    }, t('save')), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button",
      onclick: () => this.editing = null
    }, t('cancel'))));
  }
  edit(room) {
    this.confirmDelete = null;
    this.editing = room ? room.id : 'new';
    this.form = room ? {
      name: room.name,
      description: room.description || '',
      emoji: room.emoji || '',
      tagId: room.tagId,
      readonly: room.readonly,
      parentId: room.parentId
    } : {
      name: '',
      description: '',
      emoji: '',
      tagId: null,
      readonly: false,
      parentId: null
    };
  }
  save(room, data) {
    const req = room ? flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'PATCH',
      url: url('/' + room.id),
      body: data
    }) : flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'POST',
      url: url(),
      body: data
    });
    req.then(() => {
      this.editing = null;
      this.load();
    });
  }

  /** Top-level rooms, each followed by its children when its group is open. */
  visible() {
    const top = this.rooms.filter(r => !r.parentId || !this.rooms.some(p => p.id === r.parentId));
    return top.flatMap(r => [r, ...(this.openGroups.has(r.id) ? this.children(r.id) : [])]);
  }
  children(id) {
    return this.rooms.filter(r => r.parentId === id);
  }
  upload(room, e, variant) {
    if (variant === void 0) {
      variant = 'light';
    }
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('image', file);
    this.uploading = room.id;
    flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'POST',
      url: url('/' + room.id + '/image' + (variant === 'dark' ? '?variant=dark' : '')),
      body,
      serialize: raw => raw
    }).then(r => {
      this.rooms = r.rooms;
    }).finally(() => {
      this.uploading = null;
      m.redraw();
    });
  }
  removeImage(room) {
    flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'DELETE',
      url: url('/' + room.id + '/image')
    }).then(r => {
      this.rooms = r.rooms;
      m.redraw();
    });
  }
  remove(room) {
    flarum_admin_app__WEBPACK_IMPORTED_MODULE_0___default().request({
      method: 'DELETE',
      url: url('/' + room.id)
    }).then(r => {
      this.rooms = r.rooms;
      this.confirmDelete = null;
      m.redraw();
    });
  }
}
flarum.reg.add('ernestdefoe-parley', 'admin/components/RoomsManager', RoomsManager);

/***/ },

/***/ "./src/admin/index.js"
/*!****************************!*\
  !*** ./src/admin/index.js ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _components_RoomsManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./components/RoomsManager */ "./src/admin/components/RoomsManager.js");
/* harmony import */ var flarum_admin_app__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/admin/app */ "flarum/admin/app");
/* harmony import */ var flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_admin_app__WEBPACK_IMPORTED_MODULE_1__);


flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().initializers.add('ernestdefoe-parley', () => {
  flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().registry.for('ernestdefoe-parley').registerPermission({
    icon: 'fas fa-comments',
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.permissions.use'),
    permission: 'ernestdefoe-parley.use'
  }, 'start').registerPermission({
    icon: 'fas fa-user-secret',
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.permissions.hide_from_list'),
    permission: 'ernestdefoe-parley.hideFromList'
  }, 'moderate').registerPermission({
    icon: 'fas fa-flag',
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.permissions.moderate'),
    permission: 'ernestdefoe-parley.moderate'
  }, 'moderate').registerSetting(() => m("div", {
    className: "Form-group"
  }, m("label", null, flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.rooms.title')), m(_components_RoomsManager__WEBPACK_IMPORTED_MODULE_0__["default"], null))).registerSetting({
    setting: 'ernestdefoe-parley.away_minutes',
    type: 'number',
    min: 1,
    max: 120,
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.away_minutes'),
    help: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.away_minutes_help')
  }).registerSetting({
    setting: 'ernestdefoe-parley.max_image_mb',
    type: 'number',
    min: 1,
    max: 50,
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_image_mb'),
    help: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_image_mb_help')
  }).registerSetting({
    setting: 'ernestdefoe-parley.max_file_mb',
    type: 'number',
    min: 1,
    max: 200,
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_file_mb'),
    help: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_file_mb_help')
  }).registerSetting({
    setting: 'ernestdefoe-parley.max_voice_seconds',
    type: 'number',
    min: 10,
    max: 900,
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_voice_seconds'),
    help: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.max_voice_seconds_help')
  }).registerSetting({
    setting: 'ernestdefoe-parley.group_max_members',
    type: 'number',
    min: 3,
    max: 250,
    label: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.group_max_members'),
    help: flarum_admin_app__WEBPACK_IMPORTED_MODULE_1___default().translator.trans('ernestdefoe-parley.admin.settings.group_max_members_help')
  });
});

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

/***/ "flarum/admin/app"
/*!******************************************************!*\
  !*** external "flarum.reg.get('core', 'admin/app')" ***!
  \******************************************************/
(module) {

"use strict";
module.exports = flarum.reg.get('core', 'admin/app');

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
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!******************!*\
  !*** ./admin.js ***!
  \******************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _src_admin__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./src/admin */ "./src/admin/index.js");

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=admin.js.map