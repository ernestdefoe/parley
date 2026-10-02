import Icon from 'flarum/common/components/Icon';
import { readableOn } from '../util';

/**
 * A room's face. Its emoji if it has one; otherwise its tag's own icon on the
 * tag's colour — a conference room wears the conference logo; otherwise a #.
 *
 * The icon goes through Flarum's Icon component, exactly as the tag pages draw
 * it, so a Font Awesome kit treats it the same way everywhere.
 */
export default function RoomTile(room, size = 36) {
  const style = { '--s': size + 'px' };
  let face = '#';
  let className = 'pl-room-tile';

  if (room && room.emoji) {
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
