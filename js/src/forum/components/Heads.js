import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/** Conversations folded down to a face, stacked up the right edge. */
export default class Heads extends Component {
  view() {
    const s = app.parley;

    return (
      <div className={'pl-heads' + (s.open.length ? ' above' : '')}>
        {s.heads.map((id) => {
          const conv = s.conv(id);
          if (!conv) return null;
          const peer = conv.summary.participants[0] || { displayName: '?' };
          const live = { ...peer, ...s.presenceOf(peer.id) };
          const unread = s.unread[id] || 0;
          return (
            <button key={id} className="pl-head" title={peer.displayName} aria-label={extractText(t('open_with', { name: peer.displayName }))} onclick={() => s.show(id)}>
              {Avatar(live, 50, { dot: true })}
              {unread ? <span className="pl-unread">{unread}</span> : null}
              <span className="pl-x" role="button" aria-label={extractText(t('close'))} onclick={(e) => {
                e.stopPropagation();
                s.close(id);
              }}>×</span>
            </button>
          );
        })}
      </div>
    );
  }
}
