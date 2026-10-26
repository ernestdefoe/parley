import app from 'flarum/forum/app';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import extractText from 'flarum/common/utils/extractText';
import { Face } from './Avatar';
import RoomTile from './RoomTile';
import api from '../api';
import { convTitle, messagePreview } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.forward.' + key, params);

const MAX = 5;

/** Send a message on to up to five of your conversations. Loaded when opened. */
export default class ForwardModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    this.picked = new Set();
    this.query = '';
    this.list = null;
    api.conversations('all').then((r) => {
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
    const s = app.parley;
    const q = this.query.trim().toLowerCase();
    const rooms = s.rooms
      .filter((r) => r.joined && (!r.readonly || s.config.canModerate))
      .map((r) => ({ id: r.id, type: 'room', room: r, participants: [] }));
    const items = [...(this.list || []).filter((c) => !c.request), ...rooms].filter((c) => !q || convTitle(c).toLowerCase().includes(q));

    return (
      <div className="Modal-body">
        <div className="pl-forward-preview">{messagePreview(this.attrs.message)}</div>
        <div className="Form-group">
          <input
            className="FormControl"
            type="search"
            placeholder={extractText(t('search'))}
            aria-label={extractText(t('search'))}
            value={this.query}
            oninput={(e) => (this.query = e.target.value)}
          />
        </div>
        {!this.list ? (
          <LoadingIndicator />
        ) : (
          <ul className="pl-pick-list pl-forward-list">
            {items.map((c) => {
              const on = this.picked.has(c.id);
              return (
                <li>
                  <label className={'pl-forward-row' + (on ? ' on' : '')}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && this.picked.size >= MAX}
                      onchange={() => (on ? this.picked.delete(c.id) : this.picked.add(c.id))}
                    />
                    {c.type === 'room' ? RoomTile(c.room, 32) : Face(c, 32)}
                    <span>{convTitle(c)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="helpText">{t('help', { max: MAX })}</p>
        <Button className="Button Button--primary Button--block" type="submit" loading={this.loading} disabled={!this.picked.size}>
          {t('send', { count: this.picked.size })}
        </Button>
      </div>
    );
  }

  onsubmit(e) {
    e.preventDefault();
    this.loading = true;
    app.parley.forward(this.attrs.message.id, [...this.picked]).then(
      () => {
        app.alerts.show({ type: 'success' }, t('sent', { count: this.picked.size }));
        this.hide();
      },
      () => {
        this.loading = false;
        m.redraw();
      }
    );
  }
}
