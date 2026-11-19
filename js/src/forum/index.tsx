import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import UserControls from 'flarum/forum/utils/UserControls';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import ParleyState from './state';
import Parley from './components/Parley';
import api from './api';
import type { ParleyConfig } from './types';

export { default as extend } from './extend';
export { default as ParleyState } from './state';
export { default as ChatWindow } from './components/ChatWindow';
export { default as PersonRow } from './components/PersonRow';
export { default as Avatar } from './components/Avatar';
export { default as Icons } from './icons';

const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-parley.forum.' + key, params);

/*
 * Core's typings give userControls no arguments; it is called with the user
 * and the menu's component like the other control lists.
 */
const Controls = UserControls as unknown as {
  userControls(user: User, context: unknown): ItemList<Mithril.Children>;
};

app.initializers.add('ernestdefoe-parley', () => {
  /*
   * 🚨 Started from `mount`, not from the initializer. `app.forum` and the
   * session are filled in while the app boots, AFTER initializers run, and a
   * throw in an initializer is silent — the extension simply never starts.
   *
   * Patched on the `app` instance: Flarum 2 does not register
   * `forum/ForumApplication` as a module, so importing it gives undefined and
   * `.prototype` of that takes the whole initializer down.
   */
  extend(app, 'mount', function () {
    const config = app.forum.attribute<ParleyConfig | null>('parley') || {};

    if (!app.session.user) {
      guestHeartbeat();
      return;
    }

    if (!config.canUse) return;

    app.parley = new ParleyState();

    const root = document.createElement('div');
    root.id = 'Parley-root';
    document.body.appendChild(root);
    m.mount(root, Parley);

    app.parley.start();
  });

  // A new page is a new place: tell the online list now, not in 30 seconds.
  extend(Page.prototype, 'oncreate', function () {
    app.parley?.moved();
  });

  extend(Controls, 'userControls', function (items, user) {
    const s = app.parley;
    if (!s || !app.session.user || user === app.session.user) return;

    items.add(
      'parleyMessage',
      <Button icon="fas fa-comment" onclick={() => s.openWith(user.id()!)}>
        {t('controls.message')}
      </Button>,
      100
    );

    const following = s.online.some((p) => p.id === Number(user.id()) && p.following) || s.followingOffline.some((p) => p.id === Number(user.id()));
    items.add(
      'parleyFollow',
      <Button icon={following ? 'fas fa-user-minus' : 'fas fa-user-plus'} onclick={() => s.follow(user.id()!, !following)}>
        {following ? t('controls.unfollow') : t('controls.follow')}
      </Button>,
      90
    );
  });

  extend(UserControls, 'destructiveControls', function (items, user) {
    const s = app.parley;
    if (!s || !app.session.user || user === app.session.user) return;

    items.add(
      'parleyBlock',
      <Button
        icon="fas fa-ban"
        onclick={() =>
          s.block(user.id()!, true).then(() => app.alerts.show({ type: 'success' }, t('controls.blocked', { name: user.displayName() })))
        }
      >
        {t('controls.block')}
      </Button>
    );
  });

  // "Who can message me", beside the other privacy choices. Named by module
  // path: the settings page is code-split in Flarum 2.
  extend('flarum/forum/components/SettingsPage', 'privacyItems', function (items) {
    if (!app.parley) return;
    // Parley only starts for a signed-in member.
    const user = app.session.user!;
    // Core sends registered preferences with their defaults filled in.
    const current = user.preferences()?.parleyWhoCanMessage;

    items.add(
      'parleyWhoCanMessage',
      <div className="Form-group">
        <label htmlFor="Parley-who-can-message">{t('settings.who_can_message')}</label>
        <select
          id="Parley-who-can-message"
          className="FormControl"
          value={current}
          onchange={(e: Event) => user.savePreferences({ parleyWhoCanMessage: (e.target as HTMLSelectElement).value })}
        >
          <option value="everyone">{t('settings.everyone')}</option>
          <option value="everyone_inbox">{t('settings.everyone_inbox')}</option>
          <option value="following">{t('settings.following')}</option>
          <option value="nobody">{t('settings.nobody')}</option>
        </select>
        <p className="helpText">{t('settings.who_can_message_help')}</p>
      </div>,
      -10
    );
  });
});

/**
 * Guests are counted in "and 41 guests reading", never listed, never shown a
 * rail. One small request every 30 seconds while the tab is in view.
 */
function guestHeartbeat() {
  const beat = () => {
    if (document.visibilityState !== 'visible') return;
    api.heartbeat({ place: 'other' });
  };
  beat();
  setInterval(beat, 30000);
}
