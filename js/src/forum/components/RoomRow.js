import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import RoomTile from './RoomTile';
import Icons from '../icons';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.rooms.' + key, params);

/** One room in the rail: its tile, its name, who is in there now. */
export default class RoomRow extends Component {
  view() {
    const r = this.attrs.room;
    const s = app.parley;
    const open = () => s.openRoom(r.id);
    const isOpen = s.expanded.has(r.id);
    // A conference's badge counts its own unread and its joined teams'.
    const unread = (r.unread || 0) + (isOpen ? 0 : r.childUnread || 0);

    return (
      <div
        className={'pl-person pl-room' + (r.joined ? ' joined' : '') + (this.attrs.child ? ' child' : '')}
        tabindex="0"
        role="button"
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
          <div className="pl-nm">
            {r.name}
            {r.readonly ? <span className="pl-badge">{t('announcements')}</span> : null}
            {/* Set by Parley Calls: how many are in this room's voice chat. */}
            {r.voiceCount ? (
              <span className="pl-voice-tag" title={extractText(t('in_voice', { count: r.voiceCount }))}>
                {Icons.speaker()}
                {r.voiceCount}
              </span>
            ) : null}
          </div>
          <div className="pl-act">
            {r.online ? [<i className="pl-live-dot" />, t('online_count', { count: r.online }), r.description ? ' · ' : ''] : null}
            {r.description || (r.online ? null : t('members_count', { count: r.members }))}
          </div>
        </div>
        {unread ? <span className="pl-unread">{unread > 99 ? '99+' : unread}</span> : null}
        {r.children ? (
          <button
            className={'pl-ib pl-expand' + (isOpen ? ' open' : '')}
            aria-expanded={String(isOpen)}
            aria-label={extractText(t(isOpen ? 'hide_teams' : 'show_teams', { count: r.children, name: r.name }))}
            title={extractText(t(isOpen ? 'hide_teams' : 'show_teams', { count: r.children, name: r.name }))}
            onclick={(e) => {
              e.stopPropagation();
              s.toggleRoomGroup(r.id);
            }}
          >
            <span className="pl-c">{r.children}</span>
            {Icons.chev()}
          </button>
        ) : null}
      </div>
    );
  }
}
