import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type Mithril from 'mithril';

const t = (key: string) => app.translator.trans('ernestdefoe-parley.forum.status.' + key);

export const STATUSES = ['online', 'away', 'busy', 'invisible'];

export const statusColor = (s: string) => (s === 'invisible' ? 'var(--pl-offline)' : `var(--pl-${s})`);

/**
 * Online, Away, Busy, Appear offline — the Battle.net four. Away is also set
 * for you after the idle time, and lifts itself when you come back.
 */
export default class StatusMenu extends Component {
  away!: (e: PointerEvent) => void;
  esc!: (e: KeyboardEvent) => void;

  oncreate(vnode: Mithril.VnodeDOM<this['attrs'], this>) {
    super.oncreate(vnode);
    this.away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!vnode.dom.contains(target) && !target.closest('.pl-status-btn')) {
        app.parley.statusMenu = false;
        m.redraw();
      }
    };
    this.esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        app.parley.statusMenu = false;
        m.redraw();
      }
    };
    document.addEventListener('pointerdown', this.away);
    document.addEventListener('keydown', this.esc);
    vnode.dom.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }

  onremove(vnode: Mithril.VnodeDOM<this['attrs'], this>) {
    super.onremove(vnode);
    document.removeEventListener('pointerdown', this.away);
    document.removeEventListener('keydown', this.esc);
  }

  view() {
    const current = app.parley.chosenStatus;

    return (
      <div className="pl-menu" role="menu">
        {STATUSES.map((s) => (
          <button role="menuitemradio" aria-checked={String(s === current)} onclick={() => app.parley.setStatus(s)}>
            <i style={{ background: statusColor(s) }} />
            <span>
              {t(s)}
              <small>{s === 'busy' && app.parley.callsInstalled ? t('busy_desc_calls') : t(s + '_desc')}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }
}
