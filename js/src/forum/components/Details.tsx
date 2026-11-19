import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import Avatar, { Face } from './Avatar';
import RoomTile from './RoomTile';
import Icons from '../icons';
import api from '../api';
import { presenceLine } from './activity';
import { convTitle, messagePreview, fileSize, duration } from '../labels';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.details.' + key, params);

const TABS = ['media', 'files', 'links', 'pins'];

/**
 * The details column beside a conversation: who it is with, quick actions,
 * the members of a group, and what has been shared in it, a tab at a time.
 * Part of the messages page's chunk, loaded with it.
 */
export default class Details extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.tab = 'media';
    this.tabs = {};
    this.renaming = false;
    this.load(this.tab);
  }

  load(tab, more = false) {
    const id = this.attrs.id;
    const state = (this.tabs[tab] ||= { items: [], hasMore: false, loading: true });
    state.loading = true;
    const before = more && state.items.length ? state.items[state.items.length - 1].id : null;

    api.details(id, tab, before).then((r) => {
      if (r.members) app.parley.members[id] = r.members;
      state.items = more ? [...state.items, ...r.items] : r.items;
      state.hasMore = r.hasMore;
      state.loading = false;
      m.redraw();
    });
  }

  view() {
    const s = app.parley;
    const id = this.attrs.id;
    const conv = s.conv(id);
    if (!conv) return <aside className="pl-details" />;

    const summary = conv.summary;
    const isRoom = summary.type === 'room';
    const room = isRoom ? { ...(summary.room || {}), ...(s.room(id) || {}) } : null;
    const peer = summary.participants[0] || {};
    const members = s.members[id];
    const owner = summary.role === 'owner';

    return (
      <aside className="pl-details" aria-label={extractText(t('label'))}>
        <div className="pl-details-head">
          <Button
            className="Button Button--icon Button--flat pl-details-close"
            icon="fas fa-times"
            aria-label={extractText(t('close'))}
            onclick={this.attrs.onclose}
          />
          <div className="pl-details-face">
            {isRoom ? RoomTile(room, 88) : Face(summary, 88, s.presenceOf.bind(s))}
            {summary.isGroup ? (
              <label className="pl-photo-edit" title={extractText(t('change_photo'))}>
                {Icons.camera()}
                <span className="visually-hidden">{t('change_photo')}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange={(e) => this.photo(e)} />
              </label>
            ) : null}
          </div>
          {this.renaming ? (
            <form className="pl-rename" onsubmit={(e) => this.rename(e)}>
              <input
                className="FormControl"
                maxlength="80"
                value={this.name}
                placeholder={extractText(t('group_name'))}
                aria-label={extractText(t('group_name'))}
                oncreate={(v) => v.dom.focus()}
                oninput={(e) => (this.name = e.target.value)}
              />
              <Button type="submit" className="Button Button--primary">
                {t('save')}
              </Button>
            </form>
          ) : (
            <h3>
              {isRoom ? room.name : convTitle(summary)}
              {summary.isGroup ? (
                <Button
                  className="Button Button--icon Button--flat"
                  icon="fas fa-pencil-alt"
                  aria-label={extractText(t('rename'))}
                  onclick={() => {
                    this.renaming = true;
                    this.name = summary.title || '';
                  }}
                />
              ) : null}
            </h3>
          )}
          <p className="pl-details-sub">
            {isRoom
              ? room.description || ''
              : summary.isGroup
                ? app.translator.trans('ernestdefoe-parley.forum.window.members_count', { count: summary.memberCount })
                : presenceLine({ ...peer, ...s.presenceOf(peer.id) })}
          </p>
          {summary.isGroup && summary.imageUrl ? (
            <Button className="Button Button--link" onclick={() => api.groupPhoto(id, null).then((r) => s.groupChanged(r))}>
              {t('remove_photo')}
            </Button>
          ) : null}
        </div>

        {!isRoom ? (
          <div className="pl-details-actions">
            <button onclick={() => s.file(id, { muted: !summary.muted })} aria-pressed={String(!!summary.muted)}>
              {summary.muted ? Icons.bell() : Icons.muted()}
              <span>{summary.muted ? t('unmute') : t('mute')}</span>
            </button>
            <button onclick={() => this.findInChat()}>
              {Icons.search()}
              <span>{t('search')}</span>
            </button>
            <button onclick={() => this.switchTab('pins')}>
              {Icons.pin()}
              <span>{t('pins')}</span>
            </button>
            {!summary.isGroup && peer.slug ? (
              <a href={app.route('user', { username: peer.slug })}>
                <i className="icon fas fa-user" aria-hidden="true" />
                <span>{t('profile')}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {summary.isGroup ? (
          <section className="pl-members">
            <h4>
              {t('members')}
              <Button className="Button Button--link" icon="fas fa-user-plus" onclick={() => this.addPeople()}>
                {t('add_people')}
              </Button>
            </h4>
            {!members ? (
              <LoadingIndicator size="small" />
            ) : (
              members.map((p) => (
                <div className="pl-member">
                  {Avatar(p, 32, { dot: true, status: p.online ? s.presenceOf(p.id).status || 'online' : 'offline' })}
                  <span className="pl-member-nm">
                    {p.displayName}
                    {p.role === 'owner' ? <span className="pl-member-role">{t('owner')}</span> : null}
                  </span>
                  {owner && p.id !== Number(s.me.id()) ? (
                    <Button
                      className="Button Button--icon Button--flat"
                      icon="fas fa-user-minus"
                      aria-label={extractText(t('remove', { name: p.displayName }))}
                      title={extractText(t('remove', { name: p.displayName }))}
                      onclick={() =>
                        confirm(extractText(t('remove_confirm', { name: p.displayName }))) &&
                        api.removeMember(id, p.id).then((r) => s.groupChanged(r))
                      }
                    />
                  ) : null}
                </div>
              ))
            )}
            <Button
              className="Button Button--block pl-leave"
              icon="fas fa-sign-out-alt"
              onclick={() => confirm(extractText(t('leave_confirm'))) && s.leaveGroup(id)}
            >
              {t('leave')}
            </Button>
          </section>
        ) : null}

        <section className="pl-shared">
          <div className="pl-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                role="tab"
                aria-selected={String(this.tab === tab)}
                className={this.tab === tab ? 'active' : ''}
                onclick={() => this.switchTab(tab)}
              >
                {t('tab_' + tab)}
              </button>
            ))}
          </div>
          {this.tabBody(conv)}
        </section>
      </aside>
    );
  }

  switchTab(tab) {
    this.tab = tab;
    if (!this.tabs[tab] || tab === 'pins') this.load(tab);
  }

  tabBody(conv) {
    const state = this.tabs[this.tab];
    if (!state || (state.loading && !state.items.length)) return <LoadingIndicator size="small" />;
    if (!state.items.length) return <p className="pl-list-empty">{t('none_' + this.tab)}</p>;

    const open = (msg) => {
      if (conv.messages.some((x) => x.id === msg.id)) {
        conv.jumpTo = msg.id;
      } else {
        app.parley.load(conv.summary.id, { around: msg.id });
      }
    };

    const items =
      this.tab === 'media' ? (
        <div className="pl-media-grid">
          {state.items.map((msg) => (
            <a href={api.fileUrl(msg.id)} target="_blank" rel="noopener" className="pl-media-cell">
              {msg.type === 'video' ? (
                <span className="pl-media-video">
                  <i className="fas fa-play" aria-hidden="true" />
                </span>
              ) : (
                <img src={api.fileUrl(msg.id)} alt="" loading="lazy" />
              )}
            </a>
          ))}
        </div>
      ) : (
        state.items.map((msg) => (
          <button className="pl-shared-row" onclick={() => open(msg)}>
            <span className="pl-shared-icon">
              {this.tab === 'links' ? Icons.link() : this.tab === 'pins' ? Icons.pin() : msg.type === 'voice' ? Icons.mic() : Icons.file()}
            </span>
            <span className="pl-shared-text">
              <span>
                {this.tab === 'links'
                  ? (msg.body.match(/https?:\/\/\S+/) || [msg.body])[0]
                  : msg.type === 'voice'
                    ? duration((msg.meta || {}).duration)
                    : messagePreview(msg)}
              </span>
              <small>
                {msg.author ? msg.author.displayName + ' · ' : ''}
                {humanTime(msg.createdAt)}
                {msg.type === 'file' ? ' · ' + fileSize((msg.meta || {}).size) : ''}
              </small>
            </span>
          </button>
        ))
      );

    return [
      items,
      state.hasMore ? (
        <Button className="Button Button--block" onclick={() => this.load(this.tab, true)}>
          {t('more')}
        </Button>
      ) : null,
    ];
  }

  findInChat() {
    // The header's own search button: one search, one place.
    document.querySelector('.pl-win.page [data-item="search"]')?.click();
  }

  addPeople() {
    app.modal.show(() => import('./NewConversationModal'), { conversationId: this.attrs.id, members: app.parley.members[this.attrs.id] || [] });
  }

  rename(e) {
    e.preventDefault();
    api.renameGroup(this.attrs.id, this.name).then((r) => {
      this.renaming = false;
      app.parley.groupChanged(r);
    });
  }

  photo(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) api.groupPhoto(this.attrs.id, file).then((r) => app.parley.groupChanged(r));
  }
}
