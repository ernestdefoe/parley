"use strict";
(self["webpackChunk_ernestdefoe_parley"] = self["webpackChunk_ernestdefoe_parley"] || []).push([["ernestdefoe-parley:forum/components/Recorder"],{

/***/ "./src/forum/components/Recorder.js"
/*!******************************************!*\
  !*** ./src/forum/components/Recorder.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Recorder)
/* harmony export */ });
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! flarum/forum/app */ "flarum/forum/app");
/* harmony import */ var flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(flarum_forum_app__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! flarum/common/Component */ "flarum/common/Component");
/* harmony import */ var flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(flarum_common_Component__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! flarum/common/utils/extractText */ "flarum/common/utils/extractText");
/* harmony import */ var flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../icons */ "./src/forum/icons.js");
/* harmony import */ var _labels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../labels */ "./src/forum/labels.js");





const t = (key, params) => flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * Recording a voice note, in place of the message box: a red dot and the
 * time, Cancel, and Send. It stops itself at the forum's length limit.
 * Loaded the first time the microphone is pressed.
 *
 * Opus in WebM where the browser makes it (Chrome, Firefox, Edge), AAC in
 * MP4 where it does not (Safari). The server reads the bytes either way.
 */
class Recorder extends (flarum_common_Component__WEBPACK_IMPORTED_MODULE_1___default()) {
  oninit(vnode) {
    super.oninit(vnode);
    this.seconds = 0;
    this.ready = false;
    this.start();
  }
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch (e) {
      flarum_forum_app__WEBPACK_IMPORTED_MODULE_0___default().alerts.show({
        type: 'error'
      }, t('mic_denied'));
      this.attrs.ondone(null);
      m.redraw();
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(x => MediaRecorder.isTypeSupported?.(x));
    this.rec = new MediaRecorder(this.stream, type ? {
      mimeType: type,
      audioBitsPerSecond: 32000
    } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => this.finish();
    this.rec.start(1000);
    this.began = Date.now();
    this.ready = true;
    this.timer = setInterval(() => {
      this.seconds = (Date.now() - this.began) / 1000;
      if (this.seconds >= this.attrs.max) this.stop(true);
      m.redraw();
    }, 250);
    m.redraw();
  }
  stop(send) {
    this.send = send;
    clearInterval(this.timer);
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();else this.finish();
  }
  finish() {
    this.stream?.getTracks().forEach(track => track.stop());
    const seconds = Math.min(this.attrs.max, (Date.now() - (this.began || Date.now())) / 1000);
    const blob = this.send && this.chunks?.length && seconds >= 0.5 ? new Blob(this.chunks, {
      type: this.rec.mimeType
    }) : null;
    this.attrs.ondone(blob, seconds);
    m.redraw();
  }
  onremove(vnode) {
    super.onremove(vnode);
    clearInterval(this.timer);
    this.stream?.getTracks().forEach(track => track.stop());
  }
  view() {
    return m("div", {
      className: "pl-recorder",
      role: "group",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('recording'))
    }, m("button", {
      type: "button",
      className: "pl-ib",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('cancel')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('cancel')),
      onclick: () => this.stop(false)
    }, _icons__WEBPACK_IMPORTED_MODULE_3__["default"].trash()), m("span", {
      className: 'pl-rec-dot' + (this.ready ? ' on' : '')
    }), m("span", {
      className: "pl-rec-time"
    }, (0,_labels__WEBPACK_IMPORTED_MODULE_4__.duration)(this.seconds), " / ", (0,_labels__WEBPACK_IMPORTED_MODULE_4__.duration)(this.attrs.max)), m("button", {
      type: "button",
      className: "pl-ib pl-send",
      "aria-label": flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send_voice')),
      title: flarum_common_utils_extractText__WEBPACK_IMPORTED_MODULE_2___default()(t('send_voice')),
      disabled: !this.ready,
      onclick: () => this.stop(true)
    }, _icons__WEBPACK_IMPORTED_MODULE_3__["default"].send()));
  }
}
flarum.reg.add('ernestdefoe-parley', 'forum/components/Recorder', Recorder);

/***/ }

}]);
//# sourceMappingURL=Recorder.js.map