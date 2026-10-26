"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/NewConversationModal"],{

/***/ "./src/forum/components/NewConversationModal.js"
/*!******************************************************!*\
  !*** ./src/forum/components/NewConversationModal.js ***!
  \******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ NewConversationModal)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/components/FormModal */ "flarum/common/components/FormModal");
/* harmony import */ var flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");






const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.new.' + key, params);

/**
 * Start a conversation: pick one person for a direct message, or two or more
 * for a group, which can have a name and a photo. With `conversationId`, the
 * same picker adds people to an existing group.
 *
 * Loaded when it is first opened.
 */
class NewConversationModal extends (flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.chosen = [];
    this.query = '';
    this.found = [];
    this.name = '';
    this.photo = null;
    this.adding = !!this.attrs.conversationId;
    this.already = new Set((this.attrs.members || []).map(p => p.id));
  }
  className() {
    return 'Modal--small ParleyNewModal';
  }
  title() {
    return this.adding ? t('add_title') : t('title');
  }
  content() {
    const max = ((flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley).config.groupMaxMembers || 50) - 1 - (this.adding ? this.already.size - 1 : 0);
    const group = !this.adding && this.chosen.length > 1;
    return m("div", {
      className: "Modal-body"
    }, m("div", {
      className: "Form-group"
    }, m("label", {
      htmlFor: "Parley-new-to"
    }, t('to')), m("div", {
      className: "pl-chips-input FormControl",
      onclick: () => document.getElementById('Parley-new-to')?.focus()
    }, this.chosen.map(p => m("span", {
      className: "pl-person-chip"
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_4__["default"])(p, 20), " ", p.displayName, m("button", {
      type: "button",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('remove', {
        name: p.displayName
      })),
      onclick: () => this.unpick(p)
    }, "\xD7"))), m("input", {
      id: "Parley-new-to",
      autocomplete: "off",
      placeholder: this.chosen.length ? '' : flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('search')),
      value: this.query,
      disabled: this.chosen.length >= max,
      oninput: e => this.search(e.target.value),
      onkeydown: e => {
        if (e.key === 'Backspace' && !this.query && this.chosen.length) this.unpick(this.chosen[this.chosen.length - 1]);
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.found[0]) this.pick(this.found[0]);
        }
      }
    })), this.found.length ? m("ul", {
      className: "pl-pick-list",
      role: "listbox"
    }, this.found.map(p => m("li", null, m("button", {
      type: "button",
      role: "option",
      onclick: () => this.pick(p)
    }, (0,_Avatar__WEBPACK_IMPORTED_MODULE_4__["default"])(p, 28, {
      dot: true,
      status: p.online ? 'online' : 'offline'
    }), m("span", null, m("b", null, p.displayName), " ", m("small", null, "@", p.username)))))) : this.query.trim().length >= 2 && !this.searching ? m("p", {
      className: "helpText"
    }, t('nobody')) : null), group ? m("div", {
      className: "Form-group"
    }, m("label", {
      htmlFor: "Parley-new-name"
    }, t('group_name')), m("input", {
      id: "Parley-new-name",
      className: "FormControl",
      maxlength: "80",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_3___default()(t('group_name_placeholder')),
      value: this.name,
      oninput: e => this.name = e.target.value
    })) : null, group ? m("div", {
      className: "Form-group"
    }, m("label", null, t('group_photo')), m("input", {
      type: "file",
      accept: "image/png,image/jpeg,image/webp,image/gif",
      onchange: e => this.photo = e.target.files[0] || null
    })) : null, m("p", {
      className: "helpText"
    }, this.adding ? t('add_help') : group ? t('group_help') : t('direct_help')), m("div", {
      className: "Form-group"
    }, m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--primary Button--block",
      type: "submit",
      loading: this.loading,
      disabled: !this.chosen.length
    }, this.adding ? t('add_submit', {
      count: this.chosen.length
    }) : group ? t('create_group') : t('start'))));
  }
  search(q) {
    this.query = q;
    clearTimeout(this.timer);
    if (q.trim().length < 2) {
      this.found = [];
      return;
    }
    this.searching = true;
    this.timer = setTimeout(() => {
      _api__WEBPACK_IMPORTED_MODULE_5__["default"].people(q.trim()).then(r => {
        if (this.query !== q) return;
        const taken = new Set([...this.chosen.map(p => p.id), ...this.already]);
        this.found = (r.people || []).filter(p => !taken.has(p.id));
        this.searching = false;
        m.redraw();
      });
    }, 220);
  }
  pick(p) {
    this.chosen.push(p);
    this.query = '';
    this.found = [];
    setTimeout(() => document.getElementById('Parley-new-to')?.focus(), 0);
  }
  unpick(p) {
    this.chosen = this.chosen.filter(x => x.id !== p.id);
  }
  onsubmit(e) {
    e.preventDefault();
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const ids = this.chosen.map(p => p.id);
    this.loading = true;
    const fail = () => {
      this.loading = false;
      m.redraw();
    };
    if (this.adding) {
      _api__WEBPACK_IMPORTED_MODULE_5__["default"].addMembers(this.attrs.conversationId, ids).then(r => {
        s.groupChanged(r);
        this.hide();
      }, fail);
      return;
    }
    if (ids.length === 1) {
      s.openWith(ids[0]).then(() => this.hide(), fail);
      return;
    }
    s.createGroup(ids, this.name.trim() || null).then(conversation => {
      if (this.photo) _api__WEBPACK_IMPORTED_MODULE_5__["default"].groupPhoto(conversation.id, this.photo).then(r => s.groupChanged(r));
      this.hide();
    }, fail);
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/NewConversationModal', NewConversationModal);

/***/ }

}]);
//# sourceMappingURL=NewConversationModal.js.map