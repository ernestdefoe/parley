import app from 'flarum/forum/app';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import api from '../api';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.new.' + key, params);

/**
 * Start a conversation: pick one person for a direct message, or two or more
 * for a group, which can have a name and a photo. With `conversationId`, the
 * same picker adds people to an existing group.
 *
 * Loaded when it is first opened.
 */
export default class NewConversationModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    this.chosen = [];
    this.query = '';
    this.found = [];
    this.name = '';
    this.photo = null;
    this.adding = !!this.attrs.conversationId;
    this.already = new Set((this.attrs.members || []).map((p) => p.id));
  }

  className() {
    return 'Modal--small ParleyNewModal';
  }

  title() {
    return this.adding ? t('add_title') : t('title');
  }

  content() {
    const max = (app.parley.config.groupMaxMembers || 50) - 1 - (this.adding ? this.already.size - 1 : 0);
    const group = !this.adding && this.chosen.length > 1;

    return (
      <div className="Modal-body">
        <div className="Form-group">
          <label htmlFor="Parley-new-to">{t('to')}</label>
          <div className="pl-chips-input FormControl" onclick={() => document.getElementById('Parley-new-to')?.focus()}>
            {this.chosen.map((p) => (
              <span className="pl-person-chip">
                {Avatar(p, 20)} {p.displayName}
                <button type="button" aria-label={extractText(t('remove', { name: p.displayName }))} onclick={() => this.unpick(p)}>
                  ×
                </button>
              </span>
            ))}
            <input
              id="Parley-new-to"
              autocomplete="off"
              placeholder={this.chosen.length ? '' : extractText(t('search'))}
              value={this.query}
              disabled={this.chosen.length >= max}
              oninput={(e) => this.search(e.target.value)}
              onkeydown={(e) => {
                if (e.key === 'Backspace' && !this.query && this.chosen.length) this.unpick(this.chosen[this.chosen.length - 1]);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (this.found[0]) this.pick(this.found[0]);
                }
              }}
            />
          </div>
          {this.found.length ? (
            <ul className="pl-pick-list" role="listbox">
              {this.found.map((p) => (
                <li>
                  <button type="button" role="option" onclick={() => this.pick(p)}>
                    {Avatar(p, 28, { dot: true, status: p.online ? 'online' : 'offline' })}
                    <span>
                      <b>{p.displayName}</b> <small>@{p.username}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : this.query.trim().length >= 2 && !this.searching ? (
            <p className="helpText">{t('nobody')}</p>
          ) : null}
        </div>

        {group ? (
          <div className="Form-group">
            <label htmlFor="Parley-new-name">{t('group_name')}</label>
            <input
              id="Parley-new-name"
              className="FormControl"
              maxlength="80"
              placeholder={extractText(t('group_name_placeholder'))}
              value={this.name}
              oninput={(e) => (this.name = e.target.value)}
            />
          </div>
        ) : null}
        {group ? (
          <div className="Form-group">
            <label>{t('group_photo')}</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={(e) => (this.photo = e.target.files[0] || null)} />
          </div>
        ) : null}

        <p className="helpText">{this.adding ? t('add_help') : group ? t('group_help') : t('direct_help')}</p>

        <div className="Form-group">
          <Button className="Button Button--primary Button--block" type="submit" loading={this.loading} disabled={!this.chosen.length}>
            {this.adding ? t('add_submit', { count: this.chosen.length }) : group ? t('create_group') : t('start')}
          </Button>
        </div>
      </div>
    );
  }

  search(q) {
    this.query = q;
    clearTimeout(this.timer);
    if (q.trim().length < 2) {
      this.found = [];
      return;
    }
    this.searching = true;
    this.timer = setTimeout(() => {
      api.people(q.trim()).then((r) => {
        if (this.query !== q) return;
        const taken = new Set([...this.chosen.map((p) => p.id), ...this.already]);
        this.found = (r.people || []).filter((p) => !taken.has(p.id));
        this.searching = false;
        m.redraw();
      });
    }, 220);
  }

  pick(p) {
    this.chosen.push(p);
    this.query = '';
    this.found = [];
    setTimeout(() => document.getElementById('Parley-new-to')?.focus(), 0);
  }

  unpick(p) {
    this.chosen = this.chosen.filter((x) => x.id !== p.id);
  }

  onsubmit(e) {
    e.preventDefault();
    const s = app.parley;
    const ids = this.chosen.map((p) => p.id);
    this.loading = true;
    const fail = () => {
      this.loading = false;
      m.redraw();
    };

    if (this.adding) {
      api.addMembers(this.attrs.conversationId, ids).then((r) => {
        s.groupChanged(r);
        this.hide();
      }, fail);
      return;
    }

    if (ids.length === 1) {
      s.openWith(ids[0]).then(() => this.hide(), fail);
      return;
    }

    s.createGroup(ids, this.name.trim() || null).then((conversation) => {
      if (this.photo) api.groupPhoto(conversation.id, this.photo).then((r) => s.groupChanged(r));
      this.hide();
    }, fail);
  }
}
