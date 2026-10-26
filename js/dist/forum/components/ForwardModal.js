"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/ForwardModal"],{

/***/ "./src/forum/components/ForwardModal.js"
/*!**********************************************!*\
  !*** ./src/forum/components/ForwardModal.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ForwardModal)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/components/FormModal */ "flarum/common/components/FormModal");
/* harmony import */ var flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/components/Button */ "flarum/common/components/Button");
/* harmony import */ var flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! flarum/common/components/LoadingIndicator */ "flarum/common/components/LoadingIndicator");
/* harmony import */ var flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _Avatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./Avatar */ "./src/forum/components/Avatar.js");
/* harmony import */ var _RoomTile__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./RoomTile */ "./src/forum/components/RoomTile.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../api */ "./src/forum/api.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");









const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.forward.' + key, params);
const MAX = 5;

/** Send a message on to up to five of your conversations. Loaded when opened. */
class ForwardModal extends (flarum_common_components_FormModal__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.picked = new Set();
    this.query = '';
    this.list = null;
    _api__WEBPACK_IMPORTED_MODULE_7__["default"].conversations('all').then(r => {
      this.list = r.conversations;
      m.redraw();
    });
  }
  className() {
    return 'Modal--small ParleyForwardModal';
  }
  title() {
    return t('title');
  }
  content() {
    const s = (flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley);
    const q = this.query.trim().toLowerCase();
    const rooms = s.rooms.filter(r => r.joined && (!r.readonly || s.config.canModerate)).map(r => ({
      id: r.id,
      type: 'room',
      room: r,
      participants: []
    }));
    const items = [...(this.list || []).filter(c => !c.request), ...rooms].filter(c => !q || (0,_labels__WEBPACK_IMPORTED_MODULE_8__.convTitle)(c).toLowerCase().includes(q));
    return m("div", {
      className: "Modal-body"
    }, m("div", {
      className: "pl-forward-preview"
    }, (0,_labels__WEBPACK_IMPORTED_MODULE_8__.messagePreview)(this.attrs.message)), m("div", {
      className: "Form-group"
    }, m("input", {
      className: "FormControl",
      type: "search",
      placeholder: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_4___default()(t('search')),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_4___default()(t('search')),
      value: this.query,
      oninput: e => this.query = e.target.value
    })), !this.list ? m((flarum_common_components_LoadingIndicator__WEBPACK_IMPORTED_MODULE_3___default()), null) : m("ul", {
      className: "pl-pick-list pl-forward-list"
    }, items.map(c => {
      const on = this.picked.has(c.id);
      return m("li", null, m("label", {
        className: 'pl-forward-row' + (on ? ' on' : '')
      }, m("input", {
        type: "checkbox",
        checked: on,
        disabled: !on && this.picked.size >= MAX,
        onchange: () => on ? this.picked.delete(c.id) : this.picked.add(c.id)
      }), c.type === 'room' ? (0,_RoomTile__WEBPACK_IMPORTED_MODULE_6__["default"])(c.room, 32) : (0,_Avatar__WEBPACK_IMPORTED_MODULE_5__.Face)(c, 32), m("span", null, (0,_labels__WEBPACK_IMPORTED_MODULE_8__.convTitle)(c))));
    })), m("p", {
      className: "helpText"
    }, t('help', {
      max: MAX
    })), m((flarum_common_components_Button__WEBPACK_IMPORTED_MODULE_2___default()), {
      className: "Button Button--primary Button--block",
      type: "submit",
      loading: this.loading,
      disabled: !this.picked.size
    }, t('send', {
      count: this.picked.size
    })));
  }
  onsubmit(e) {
    e.preventDefault();
    this.loading = true;
    flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().parley.forward(this.attrs.message.id, [...this.picked]).then(() => {
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
        type: 'success'
      }, t('sent', {
        count: this.picked.size
      }));
      this.hide();
    }, () => {
      this.loading = false;
      m.redraw();
    });
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/ForwardModal', ForwardModal);

/***/ }

}]);
//# sourceMappingURL=ForwardModal.js.map