/** A room's face: its emoji, or a #, on a rounded tile. */
export default function RoomTile(room, size = 36) {
  return (
    <span className="pl-room-tile" style={{ '--s': size + 'px' }} aria-hidden="true">
      {room && room.emoji ? room.emoji : '#'}
    </span>
  );
}
