import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import RoomTile from './RoomTile';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.rooms.' + key, params);

/** One room in the rail: its tile, its name, who is in there now. */
export default class RoomRow extends Component {
  view() {
    const r = this.attrs.room;
    const open = () => app.parley.openRoom(r.id);

    return (
      <div className={'pl-person pl-room' + (r.joined ? ' joined' : '')} tabindex="0" role="button"
        aria-label={extractText(t('open', { name: r.name }))}
        onclick={open}
        onkeydown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            open();
          }
        }}
      >
        {RoomTile(r, 36)}
        <div className="pl-info">
          <div className="pl-nm">{r.name}{r.readonly ? <span className="pl-badge">{t('announcements')}</span> : null}</div>
          <div className="pl-act">
            {r.online ? [<i className="pl-live-dot" />, t('online_count', { count: r.online }), r.description ? ' · ' : ''] : null}
            {r.description || (r.online ? null : t('members_count', { count: r.members }))}
          </div>
        </div>
        {r.unread ? <span className="pl-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}
      </div>
    );
  }
}
