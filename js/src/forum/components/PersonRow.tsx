import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import Avatar from './Avatar';
import Icons from '../icons';
import { activityLine, activityHref } from './activity';
import type { Person } from '../types';

const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-parley.forum.' + key, params);

/**
 * One person in the online list. Click anywhere on the row to message them;
 * hover for the buttons on the right.
 */
export interface PersonRowAttrs extends ComponentAttrs {
  person: Person;
  unread?: number;
}

export default class PersonRow extends Component<PersonRowAttrs> {
  view() {
    const p = this.attrs.person;
    const unread = this.attrs.unread || 0;
    const name = p.displayName;

    return (
      <div
        className={'pl-person' + (p.status === 'offline' ? ' off' : '')}
        tabindex="0"
        role="button"
        aria-label={extractText(t('rail.message_person', { name }))}
        onclick={() => app.parley.openWith(p.id)}
        onkeydown={(e: KeyboardEvent) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            app.parley.openWith(p.id);
          }
        }}
      >
        {Avatar(p, 36, { dot: true })}
        <div className="pl-info">
          <div className="pl-nm">
            {name}
            {p.badge ? <span className={'pl-badge' + (p.badge.staff ? ' mod' : '')}>{p.badge.name}</span> : null}
          </div>
          <div className="pl-act">{activityLine(p)}</div>
        </div>
        {unread ? <span className="pl-unread">{unread}</span> : null}
        <span className="pl-acts" onclick={(e: MouseEvent) => e.stopPropagation()}>
          {this.actionItems(p).toArray()}
        </span>
      </div>
    );
  }

  /**
   * The hover buttons. Parley Calls adds voice and video here and takes the
   * message button away, exactly as the two editions differ in the mockup.
   */
  actionItems(p: Person): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const href = activityHref(p);

    // In a room you can see: "Go to" opens the room itself.
    if (p.activity && p.activity.roomId) {
      items.add(
        'goto',
        <button
          className="pl-ib"
          title={extractText(t('rail.go_to', { place: p.activity.label }))}
          aria-label={extractText(t('rail.go_to', { place: p.activity.label }))}
          onclick={() => app.parley.openRoom(p.activity!.roomId!)}
        >
          {Icons.goto()}
        </button>,
        100
      );
    }

    if (href) {
      items.add(
        'goto',
        <a
          className="pl-ib"
          href={href}
          title={extractText(t('rail.go_to', { place: p.activity!.label }))}
          aria-label={extractText(t('rail.go_to', { place: p.activity!.label }))}
          onclick={(e: MouseEvent) => {
            e.preventDefault();
            m.route.set(href);
          }}
        >
          {Icons.goto()}
        </a>,
        100
      );
    }

    items.add(
      'message',
      <button
        className="pl-ib"
        title={extractText(t('rail.message'))}
        aria-label={extractText(t('rail.message_person', { name: p.displayName }))}
        onclick={() => app.parley.openWith(p.id)}
      >
        {Icons.msg()}
      </button>,
      0
    );

    return items;
  }
}
