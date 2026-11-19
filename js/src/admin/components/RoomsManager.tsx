import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Icon from 'flarum/common/components/Icon';
import type Model from 'flarum/common/Model';
import type Mithril from 'mithril';

import { readableOn } from '../../forum/util';
import type { RoomCard } from '../../forum/types';

const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-parley.admin.rooms.' + key, params);
const url = (path = '') => app.forum.attribute<string>('apiUrl') + '/parley/admin/rooms' + path;

/** A room as the admin rooms endpoints return it: its card and its member count. */
type AdminRoom = RoomCard & { members: number };

/** Every admin rooms endpoint answers with the whole list. */
interface RoomsResponse {
  rooms: AdminRoom[];
}

/** What the editor sends; select values arrive as strings. */
interface RoomForm {
  name?: string;
  description?: string;
  emoji?: string;
  tagId?: number | string | null;
  readonly?: boolean;
  parentId?: number | string | null;
  archived?: boolean;
}

/** Flarum Tags' model, as far as this page reads it. */
type Tag = Model & { name(): string };

/**
 * The rooms, in the order members see them. Drag a row to move it; nothing
 * here uses up and down arrows.
 */
export default class RoomsManager extends Component {
  rooms!: AdminRoom[] | null;
  editing!: number | 'new' | null;
  form!: RoomForm;
  confirmDelete!: number | null;
  dragging!: number | null;
  openGroups!: Set<number>;
  uploading?: number | null;

  oninit(vnode: Mithril.Vnode<this['attrs'], this>) {
    super.oninit(vnode);
    this.rooms = null;
    this.editing = null; // a room's id, 'new', or null
    this.form = {};
    this.confirmDelete = null;
    this.dragging = null;
    this.openGroups = new Set();
    this.load();
  }

  load() {
    app.request<RoomsResponse>({ method: 'GET', url: url() }).then((r) => {
      this.rooms = r.rooms;
      m.redraw();
    });
  }

  view() {
    if (!this.rooms) return <LoadingIndicator />;
    const tags = app.store.all<Tag>('tags');

    return (
      <div className="ParleyRooms">
        <p className="helpText">{t('help')}</p>
        <ul className="ParleyRooms-list">
          {/*
            🚨 One flat, fully keyed list. The new-room row used to sit beside
            this.rooms.map(...) — an unkeyed block next to a keyed row — and
            Mithril threw on the redraw after "Add a room", so the click
            appeared to do nothing.
          */}
          {[
            ...this.visible().map((r) => (
              <li
                key={r.id}
                className={
                  'ParleyRooms-row' + (r.parentId ? ' child' : '') + (r.archived ? ' archived' : '') + (this.dragging === r.id ? ' dragging' : '')
                }
                draggable={this.editing === null ? 'true' : 'false'}
                ondragstart={(e: DragEvent) => {
                  this.dragging = r.id;
                  e.dataTransfer!.effectAllowed = 'move';
                  e.dataTransfer!.setData('text/plain', String(r.id));
                }}
                ondragover={(e: DragEvent) => {
                  e.preventDefault();
                  if (this.dragging === null || this.dragging === r.id) return;
                  const list = this.rooms!;
                  const from = list.findIndex((x) => x.id === this.dragging);
                  const to = list.findIndex((x) => x.id === r.id);
                  // Rooms move among their own level: a team stays under its conference.
                  if ((list[from].parentId || null) !== (r.parentId || null)) return;
                  const [moved] = list.splice(from, 1);
                  list.splice(to, 0, moved);
                }}
                ondragend={() => {
                  this.dragging = null;
                  const list = this.rooms!;
                  const level = list.find((x) => x.id === r.id)?.parentId || null;
                  app
                    .request<RoomsResponse>({
                      method: 'POST',
                      url: url('/order'),
                      body: { ids: list.filter((x) => (x.parentId || null) === level).map((x) => x.id) },
                    })
                    .then((res) => {
                      this.rooms = res.rooms;
                      m.redraw();
                    });
                }}
              >
                {this.editing === r.id
                  ? this.editor(tags)
                  : [
                      <span className="ParleyRooms-grip" aria-hidden="true">
                        ⠿
                      </span>,
                      this.tile(r),
                      <span className="ParleyRooms-info">
                        <b>{r.name}</b>
                        <small>
                          {this.children(r.id).length
                            ? [
                                <a
                                  href="#"
                                  onclick={(e: MouseEvent) => {
                                    e.preventDefault();
                                    this.openGroups.has(r.id) ? this.openGroups.delete(r.id) : this.openGroups.add(r.id);
                                  }}
                                >
                                  {t(this.openGroups.has(r.id) ? 'hide_rooms' : 'show_rooms', { count: this.children(r.id).length })}
                                </a>,
                                ' · ',
                              ]
                            : null}
                          {r.tagId
                            ? t('in_tag', { tag: (tags.find((x) => Number(x.id()) === r.tagId) || { name: () => '?' }).name() })
                            : t('everyone')}
                          {' · '}
                          {t('members', { count: r.members || 0 })}
                          {r.readonly ? [' · ', t('announcements')] : null}
                          {r.archived ? [' · ', t('archived')] : null}
                        </small>
                      </span>,
                      <span className="ParleyRooms-actions">
                        {this.confirmDelete === r.id
                          ? [
                              <Button className="Button Button--danger" onclick={() => this.remove(r)}>
                                {t('delete_confirm')}
                              </Button>,
                              <Button className="Button" onclick={() => (this.confirmDelete = null)}>
                                {t('cancel')}
                              </Button>,
                            ]
                          : [
                              <Button className="Button" onclick={() => this.edit(r)}>
                                {t('edit')}
                              </Button>,
                              <Button
                                className="Button"
                                loading={this.uploading === r.id}
                                onclick={(e: MouseEvent) =>
                                  ((e.currentTarget as HTMLElement).parentNode as ParentNode)
                                    .querySelector<HTMLInputElement>('input[type=file]')!
                                    .click()
                                }
                              >
                                {r.imageUrl ? t('replace_logo') : t('upload_logo')}
                              </Button>,
                              <input
                                type="file"
                                hidden
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onchange={(e: Event) => this.upload(r, e)}
                              />,
                              r.imageUrl ? (
                                <Button className="Button" onclick={() => this.removeImage(r)}>
                                  {t('remove_logo')}
                                </Button>
                              ) : null,
                              r.imageUrl ? (
                                <Button
                                  className="Button"
                                  onclick={(e: MouseEvent) =>
                                    ((e.currentTarget as HTMLElement).parentNode as ParentNode).querySelector<HTMLInputElement>('input.dark')!.click()
                                  }
                                >
                                  {r.imageDarkUrl && !r.imageDarkUrl.includes('-dark-auto-') ? t('replace_dark_logo') : t('upload_dark_logo')}
                                </Button>
                              ) : null,
                              r.imageUrl ? (
                                <input
                                  type="file"
                                  className="dark"
                                  hidden
                                  accept="image/png,image/jpeg,image/webp,image/gif"
                                  onchange={(e: Event) => this.upload(r, e, 'dark')}
                                />
                              ) : null,
                              <Button className="Button" onclick={() => this.save(r, { archived: !r.archived })}>
                                {r.archived ? t('restore') : t('archive')}
                              </Button>,
                              <Button className="Button Button--danger" onclick={() => (this.confirmDelete = r.id)}>
                                {t('delete')}
                              </Button>,
                            ]}
                      </span>,
                    ]}
              </li>
            )),
            this.editing === 'new' ? (
              <li key="new" className="ParleyRooms-row">
                {this.editor(tags)}
              </li>
            ) : null,
          ].filter(Boolean)}
        </ul>
        {this.editing === null ? (
          <Button className="Button Button--primary" icon="fas fa-plus" onclick={() => this.edit(null)}>
            {t('add')}
          </Button>
        ) : null}
      </div>
    );
  }

  /** The same face members see: emoji, else the tag's logo on its colour, else #. */
  tile(r: AdminRoom) {
    if (r.imageUrl)
      return (
        <span className="ParleyRooms-tile image">
          <img src={r.imageUrl} alt="" />
        </span>
      );
    if (r.emoji || !r.tagIcon) return <span className="ParleyRooms-tile">{r.emoji || '#'}</span>;
    return (
      <span className="ParleyRooms-tile logo" style={r.tagColor ? { background: r.tagColor, color: readableOn(r.tagColor) } : {}}>
        <Icon name={r.tagIcon} />
      </span>
    );
  }

  editor(tags: Tag[]) {
    const f = this.form;
    const value = (e: Event) => (e.target as HTMLInputElement).value;
    return (
      <form
        className="ParleyRooms-editor"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          this.save(this.editing === 'new' ? null : { id: this.editing as number }, f);
        }}
      >
        <div className="ParleyRooms-fields">
          <input
            className="FormControl ParleyRooms-emoji"
            id="ParleyRooms-emoji"
            placeholder={app.translator.trans('ernestdefoe-parley.admin.rooms.emoji_placeholder')}
            title={app.translator.trans('ernestdefoe-parley.admin.rooms.emoji_help')}
            maxlength="8"
            value={f.emoji}
            oninput={(e: Event) => (f.emoji = value(e))}
            aria-label={t('emoji')}
          />
          <input
            className="FormControl"
            id="ParleyRooms-name"
            placeholder={t('name')}
            required
            maxlength="80"
            value={f.name}
            oninput={(e: Event) => (f.name = value(e))}
            aria-label={t('name')}
          />
        </div>
        <input
          className="FormControl"
          id="ParleyRooms-description"
          placeholder={t('description')}
          maxlength="300"
          value={f.description}
          oninput={(e: Event) => (f.description = value(e))}
          aria-label={t('description')}
        />
        <label htmlFor="ParleyRooms-tag">{t('who_sees')}</label>
        <select className="FormControl" id="ParleyRooms-tag" value={f.tagId || ''} onchange={(e: Event) => (f.tagId = value(e) || null)}>
          <option value="">{t('everyone')}</option>
          {tags.map((tag) => (
            <option value={tag.id()}>{t('same_as_tag', { tag: tag.name() })}</option>
          ))}
        </select>
        <label htmlFor="ParleyRooms-parent">{t('parent')}</label>
        <select className="FormControl" id="ParleyRooms-parent" value={f.parentId || ''} onchange={(e: Event) => (f.parentId = value(e) || null)}>
          <option value="">{t('no_parent')}</option>
          {this.rooms!.filter((r) => !r.parentId && r.id !== this.editing).map((r) => (
            <option value={r.id}>{r.name}</option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            id="ParleyRooms-readonly"
            checked={!!f.readonly}
            onchange={(e: Event) => (f.readonly = (e.target as HTMLInputElement).checked)}
          />{' '}
          {t('readonly')}
        </label>
        <div className="ParleyRooms-actions">
          <Button className="Button Button--primary" type="submit">
            {t('save')}
          </Button>
          <Button className="Button" onclick={() => (this.editing = null)}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    );
  }

  edit(room: AdminRoom | null) {
    this.confirmDelete = null;
    this.editing = room ? room.id : 'new';
    this.form = room
      ? {
          name: room.name,
          description: room.description || '',
          emoji: room.emoji || '',
          tagId: room.tagId,
          readonly: room.readonly,
          parentId: room.parentId,
        }
      : { name: '', description: '', emoji: '', tagId: null, readonly: false, parentId: null };
  }

  save(room: { id: number } | null, data: RoomForm) {
    const req = room
      ? app.request<RoomsResponse>({ method: 'PATCH', url: url('/' + room.id), body: data })
      : app.request<RoomsResponse>({ method: 'POST', url: url(), body: data });
    req.then(() => {
      this.editing = null;
      this.load();
    });
  }

  /** Top-level rooms, each followed by its children when its group is open. */
  visible(): AdminRoom[] {
    const rooms = this.rooms!;
    const top = rooms.filter((r) => !r.parentId || !rooms.some((p) => p.id === r.parentId));
    return top.flatMap((r) => [r, ...(this.openGroups.has(r.id) ? this.children(r.id) : [])]);
  }

  children(id: number): AdminRoom[] {
    return this.rooms!.filter((r) => r.parentId === id);
  }

  upload(room: AdminRoom, e: Event, variant = 'light') {
    const input = e.target as HTMLInputElement;
    const file = input.files![0];
    input.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('image', file);
    this.uploading = room.id;
    app
      .request<RoomsResponse>({
        method: 'POST',
        url: url('/' + room.id + '/image' + (variant === 'dark' ? '?variant=dark' : '')),
        body,
        serialize: (raw: FormData) => raw,
      })
      .then((r) => {
        this.rooms = r.rooms;
      })
      .finally(() => {
        this.uploading = null;
        m.redraw();
      });
  }

  removeImage(room: AdminRoom) {
    app.request<RoomsResponse>({ method: 'DELETE', url: url('/' + room.id + '/image') }).then((r) => {
      this.rooms = r.rooms;
      m.redraw();
    });
  }

  remove(room: AdminRoom) {
    app.request<RoomsResponse>({ method: 'DELETE', url: url('/' + room.id) }).then((r) => {
      this.rooms = r.rooms;
      this.confirmDelete = null;
      m.redraw();
    });
  }
}
