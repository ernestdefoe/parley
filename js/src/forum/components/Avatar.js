import stringToColor from 'flarum/common/utils/stringToColor';
import { initials } from '../util';

/**
 * A round avatar with an optional status dot. The member's own picture when
 * they have one; otherwise their initials on the colour Flarum itself gives
 * that name, so a face here matches the same face in the discussion list.
 */
export default function Avatar(person, size = 34, opts = {}) {
  const name = person.displayName || person.username || '?';
  const style = { '--s': size + 'px', '--size': size + 'px' };
  if (!person.avatarUrl) style['--avatar-bg'] = '#' + stringToColor(person.username || name);

  return (
    <span className={'pl-av Avatar' + (opts.className ? ' ' + opts.className : '')} style={style} aria-hidden="true">
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" loading="lazy" /> : initials(name)}
      {opts.dot ? <span className={'pl-dot ' + (opts.status || person.status || 'offline')} /> : null}
    </span>
  );
}

/**
 * A conversation's face: the other person, or a group's photo, or — for a
 * group without one — two of its members, one over the other.
 */
export function Face(summary, size = 40, presenceOf = null) {
  if (summary.isGroup) {
    if (summary.imageUrl) {
      return (
        <span className="pl-av Avatar pl-group-photo" style={{ '--s': size + 'px', '--size': size + 'px' }} aria-hidden="true">
          <img src={summary.imageUrl} alt="" loading="lazy" />
        </span>
      );
    }
    const [a, b] = summary.participants || [];
    const small = Math.round(size * 0.68);
    return (
      <span className="pl-stack" style={{ '--s': size + 'px' }} aria-hidden="true">
        {a ? Avatar(a, small, { className: 'pl-stack-a' }) : null}
        {b ? Avatar(b, small, { className: 'pl-stack-b' }) : null}
      </span>
    );
  }

  const peer = (summary.participants || [])[0] || { displayName: '?' };
  const live = presenceOf ? { ...peer, ...presenceOf(peer.id) } : peer;
  return Avatar(live, size, { dot: !!presenceOf });
}
