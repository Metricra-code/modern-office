'use client';
import { Phone, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_LABEL } from '@/lib/presence';
import type { Player } from '@/lib/protocol';

interface PeopleViewProps {
  players: readonly Player[];
  selfId: string;
  isDemo: boolean;
  onCall: (player: Player) => void;
}
export const PeopleView = ({ players, selfId, isDemo, onCall }: PeopleViewProps) => (
  <>
    <div className="conversation-context">
      <Users size={15} /> {players.length} {isDemo ? 'sample teammates' : 'guests here'}
    </div>
    <div
      id="chat-content"
      role="tabpanel"
      tabIndex={0}
      aria-labelledby="tab-people"
      className="chat-content"
    >
      <div className="people-list">
        {players.map((player) => (
          <div className="people-row" key={player.id}>
            <Avatar {...player} />
            <div>
              <strong>
                {player.name}
                {player.id === selfId ? ' (you)' : ''}
              </strong>
              <span>
                {STATUS_LABEL[player.status]}
                {isDemo && player.id !== selfId ? ' · sample' : ''}
              </span>
            </div>
            {player.id !== selfId && (
              <button
                className="icon-button"
                aria-label={`Call ${player.name}`}
                onClick={() => onCall(player)}
              >
                <Phone size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  </>
);
