import type { Player, RoomId } from '@/lib/protocol';
import { getRoom, ROOMS } from '@/lib/space';
import { ROOM_ICONS } from './room-icons';

interface RoomStripProps {
  players: readonly Player[];
  activeRoom: RoomId;
  onRoom: (room: RoomId) => void;
}
export const RoomStrip = ({ players, activeRoom, onRoom }: RoomStripProps) => (
  <nav className="room-strip" aria-label="Move to a room">
    {ROOMS.map((space) => {
      const Icon = ROOM_ICONS[space.id];
      const count = players.filter((player) => getRoom(player) === space.id).length;
      return (
        <button
          key={space.id}
          className={space.id === activeRoom ? 'active-room-card' : ''}
          onClick={() => onRoom(space.id)}
          aria-label={`Go to ${space.name}`}
          aria-current={space.id === activeRoom ? 'location' : undefined}
        >
          <Icon size={16} />
          <strong>{space.name}</strong>
          <span>{count}</span>
        </button>
      );
    })}
  </nav>
);
