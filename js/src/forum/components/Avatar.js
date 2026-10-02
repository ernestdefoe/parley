import { hue, initials } from '../util';

/**
 * A round avatar with an optional status dot. The member's own picture when
 * they have one; otherwise their initials on a colour of their own, as in the
 * mockup.
 */
export default function Avatar(person, size = 34, opts = {}) {
  const name = person.displayName || person.username || '?';
  const style = { '--s': size + 'px' };
  if (!person.avatarUrl) style.background = `hsl(${hue(name)} 52% 46%)`;

  return (
    <span className={'pl-av' + (opts.className ? ' ' + opts.className : '')} style={style} aria-hidden="true">
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" loading="lazy" /> : initials(name)}
      {opts.dot ? <span className={'pl-dot ' + (opts.status || person.status || 'offline')} /> : null}
    </span>
  );
}
