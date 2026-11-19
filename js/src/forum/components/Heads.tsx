import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import { Face } from './Avatar';
import RoomTile from './RoomTile';
import { convTitle } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** Conversations folded down to a face, stacked up the right edge. */
export default class Heads extends Component {
  view() {
    const s = app.parley;

    return (
      <div className={'pl-heads' + (s.open.length ? ' above' : '')}>
        {s.heads
          .filter((id) => s.conv(id))
          .map((id) => {
            // Filtered first: a keyed list must not start with a null hole.
            const conv = s.conv(id);
            const name = convTitle(conv.summary);
            const unread = s.unread[id] || 0;
            return (
              <button key={id} className="pl-head" title={name} aria-label={extractText(t('open_with', { name }))} onclick={() => s.show(id)}>
                {conv.summary.type === 'room'
                  ? RoomTile({ ...(conv.summary.room || {}), ...(s.room(id) || {}) }, 50)
                  : Face(conv.summary, 50, s.presenceOf.bind(s))}
                {unread ? <span className="pl-unread">{unread > 99 ? '99+' : unread}</span> : null}
                <span
                  className="pl-x"
                  role="button"
                  aria-label={extractText(t('close'))}
                  onclick={(e) => {
                    e.stopPropagation();
                    s.close(id);
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}
      </div>
    );
  }
}
