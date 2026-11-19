import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';

const t = (key) => app.translator.trans('ernestdefoe-parley.forum.emoji.' + key);

/*
 * A small picker of the emoji people actually send, by group. Loaded the
 * first time the smiley is pressed; nothing of it is in the page before.
 * Anything not here can still be typed with the system's own emoji keyboard.
 */
const GROUPS = {
  smileys:
    '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖',
  people:
    '👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤏 💪 🙏 👏 🙌 👐 🤲 🤝 ✍️ 💅 👀 🧠 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙋 🙅 🙆 💁 🤷 🤦 🙇 💃 🕺 🏃 🚶',
  hearts: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡ 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅',
  nature:
    '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐬 🐳 🦈 🌸 🌹 🌻 🌲 🌴 🍀 🍁 🌈 ☀️ ⛅ 🌧️ ❄️ ☃️ 🌊',
  food: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌶️ 🌽 🥕 🥐 🍞 🧀 🥚 🍳 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍣 🍤 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍵 🍺 🍻 🥂 🍷 🥃 🍹',
  activity:
    '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 ⛳ 🎣 🎿 🏂 🏋️ 🚴 🏊 🎮 🕹️ 🎲 🎯 🎳 🎸 🎹 🎺 🎻 🥁 🎤 🎧 🎬 🎨 📷 💻 📱 ⌚ 💡 📚 ✏️ 📌 📎 🔑 🔒 🚗 ✈️ 🚀 🏠 ⏰ ✅ ❌ ❓ ❗',
};

export default class EmojiPicker extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.group = 'smileys';
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    // Clicking anywhere else closes it.
    this.away = (e) => {
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
    return (
      <div className="pl-emoji Dropdown-menu" role="dialog" aria-label={extractText(t('label'))}>
        <div className="pl-emoji-tabs" role="tablist">
          {Object.keys(GROUPS).map((g) => (
            <button
              type="button"
              role="tab"
              aria-selected={String(this.group === g)}
              aria-label={extractText(t(g))}
              title={extractText(t(g))}
              onclick={() => (this.group = g)}
            >
              {GROUPS[g].split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="pl-emoji-grid">
          {GROUPS[this.group].split(' ').map((e) => (
            <button type="button" aria-label={e} onclick={() => this.attrs.onpick(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  }
}
