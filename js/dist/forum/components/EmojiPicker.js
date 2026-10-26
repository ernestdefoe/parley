"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/EmojiPicker"],{

/***/ "./src/forum/components/EmojiPicker.js"
/*!*********************************************!*\
  !*** ./src/forum/components/EmojiPicker.js ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ EmojiPicker)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);



const t = key => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.emoji.' + key);

/*
 * A small picker of the emoji people actually send, by group. Loaded the
 * first time the smiley is pressed; nothing of it is in the page before.
 * Anything not here can still be typed with the system's own emoji keyboard.
 */
const GROUPS = {
  smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖',
  people: '👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤏 💪 🙏 👏 🙌 👐 🤲 🤝 ✍️ 💅 👀 🧠 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙋 🙅 🙆 💁 🤷 🤦 🙇 💃 🕺 🏃 🚶',
  hearts: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡ 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅',
  nature: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐬 🐳 🦈 🌸 🌹 🌻 🌲 🌴 🍀 🍁 🌈 ☀️ ⛅ 🌧️ ❄️ ☃️ 🌊',
  food: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌶️ 🌽 🥕 🥐 🍞 🧀 🥚 🍳 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍣 🍤 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍵 🍺 🍻 🥂 🍷 🥃 🍹',
  activity: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 ⛳ 🎣 🎿 🏂 🏋️ 🚴 🏊 🎮 🕹️ 🎲 🎯 🎳 🎸 🎹 🎺 🎻 🥁 🎤 🎧 🎬 🎨 📷 💻 📱 ⌚ 💡 📚 ✏️ 📌 📎 🔑 🔒 🚗 ✈️ 🚀 🏠 ⏰ ✅ ❌ ❓ ❗'
};
class EmojiPicker extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.group = 'smileys';
  }
  oncreate(vnode) {
    super.oncreate(vnode);
    // Clicking anywhere else closes it.
    this.away = e => {
      if (!vnode.dom.contains(e.target) && !e.target.closest('.pl-emoji-btn')) this.attrs.onclose();
      m.redraw();
    };
    setTimeout(() => document.addEventListener('pointerdown', this.away), 0);
  }
  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('pointerdown', this.away);
  }
  view() {
    return m("div", {
      className: "pl-emoji Dropdown-menu",
      role: "dialog",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('label'))
    }, m("div", {
      className: "pl-emoji-tabs",
      role: "tablist"
    }, Object.keys(GROUPS).map(g => m("button", {
      type: "button",
      role: "tab",
      "aria-selected": String(this.group === g),
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t(g)),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t(g)),
      onclick: () => this.group = g
    }, GROUPS[g].split(' ')[0]))), m("div", {
      className: "pl-emoji-grid"
    }, GROUPS[this.group].split(' ').map(e => m("button", {
      type: "button",
      "aria-label": e,
      onclick: () => this.attrs.onpick(e)
    }, e))));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/EmojiPicker', EmojiPicker);

/***/ }

}]);
//# sourceMappingURL=EmojiPicker.js.map