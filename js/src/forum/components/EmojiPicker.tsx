import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import extractText from 'flarum/common/utils/extractText';

const t = (key: string) => app.translator.trans('ernestdefoe-parley.forum.emoji.' + key);

/*
 * A small picker of the emoji people actually send, by group. Loaded the
 * first time the smiley is pressed; nothing of it is in the page before.
 * Anything not here can still be typed with the system's own emoji keyboard.
 */
const GROUPS: Record<string, string> = {
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

export interface EmojiPickerAttrs extends ComponentAttrs {
  /** Called with the emoji pressed. */
  onpick: (emoji: string) => void;
  /** Called when a press lands anywhere outside the picker. */
  onclose: () => void;
}

export default class EmojiPicker extends Component<EmojiPickerAttrs> {
  group!: string;
  away?: (e: PointerEvent) => void;

  oninit(vnode: Mithril.Vnode<EmojiPickerAttrs, this>) {
    super.oninit(vnode);
    this.group = 'smileys';
  }

  oncreate(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>) {
    super.oncreate(vnode);
    // Clicking anywhere else closes it.
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!vnode.dom.contains(target) && !target.closest('.pl-emoji-btn')) this.attrs.onclose();
      m.redraw();
    };
    this.away = away;
    setTimeout(() => document.addEventListener('pointerdown', away), 0);
  }

  onremove(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>) {
    super.onremove(vnode);
    if (this.away) document.removeEventListener('pointerdown', this.away);
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
