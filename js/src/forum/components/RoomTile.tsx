import Icon from 'flarum/common/components/Icon';
import { readableOn } from '../util';

/**
 * A room's face. Its own logo if one was uploaded — on a white badge in both
 * themes, because a logo is drawn for white and several vanish on dark. Then
 * its emoji; otherwise its tag's own icon on the
 * tag's colour — a conference room wears the conference logo; otherwise a #.
 *
 * The icon goes through Flarum's Icon component, exactly as the tag pages draw
 * it, so a Font Awesome kit treats it the same way everywhere.
 */
export default function RoomTile(room, size = 36) {
  const style = { '--s': size + 'px' };
  let face = '#';
  let className = 'pl-room-tile';

  if (room && room.imageUrl) {
    // Both versions are in the page; the theme decides which shows, so a
    // switch to dark mode needs no redraw. No dark version: the logo itself.
    face = [
      <img className="pl-logo-light" src={room.imageUrl} alt="" loading="lazy" />,
      room.imageDarkUrl ? <img className="pl-logo-dark" src={room.imageDarkUrl} alt="" loading="lazy" /> : null,
    ];
    className += ' image' + (room.imageDarkUrl ? ' has-dark' : '');
  } else if (room && room.emoji) {
    face = room.emoji;
  } else if (room && room.tagIcon) {
    face = <Icon name={room.tagIcon} />;
    className += ' logo';
    if (room.tagColor) {
      style.background = room.tagColor;
      // A white logo on a gold tag cannot be read; pick by the background.
      style.color = readableOn(room.tagColor);
    }
  }

  return (
    <span className={className} style={style} aria-hidden="true">
      {face}
    </span>
  );
}
