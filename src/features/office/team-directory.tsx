import { ArrowUpRight } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_LABEL } from '@/lib/presence';
import type { Player } from '@/lib/protocol';
import { getRoom, getRoomDetails } from '@/lib/space';

interface TeamDirectoryProps {
  players: readonly Player[];
  selfId: string;
  isDemo: boolean;
  onSelect: (player: Player) => void;
}
export const TeamDirectory = ({ players, selfId, isDemo, onSelect }: TeamDirectoryProps) => (
  <div className="team-directory">
    <div className="team-intro">
      <h3>Workspace members</h3>
      <p>
        {isDemo
          ? 'Sample profiles, not people currently online. Join a live room to meet other guests.'
          : 'Guests connected to this workspace. Select someone to start a call.'}
      </p>
    </div>
    {players.map((player) => (
      <button className="team-member" key={player.id} onClick={() => onSelect(player)}>
        <Avatar {...player} size="large" />
        <span>
          <strong>
            {player.name}
            {player.id === selfId ? ' (you)' : ''}
          </strong>
          <span>
            {getRoomDetails(getRoom(player)).name} · {STATUS_LABEL[player.status]}
          </span>
        </span>
        <ArrowUpRight size={19} />
      </button>
    ))}
  </div>
);
