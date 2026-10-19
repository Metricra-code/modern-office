import { ArrowRight, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { STATUS_LABEL } from '@/lib/presence';
import type { Player } from '@/lib/protocol';
import { getRoom, getRoomDetails } from '@/lib/space';

interface MemberDialogProps {
  member?: Player;
  isDemo: boolean;
  connected: boolean;
  present: boolean;
  canCall: boolean;
  onConnectLive: () => void;
  onCall: (player: Player) => void;
  onClose: () => void;
}
export const MemberDialog = ({
  member,
  isDemo,
  connected,
  present,
  canCall,
  onConnectLive,
  onCall,
  onClose,
}: MemberDialogProps) => (
  <Dialog open={Boolean(member)} title={member?.name ?? 'Teammate'} onClose={onClose}>
    {member && (
      <div className="member-detail">
        <Avatar {...member} size="large" />
        <p>
          {getRoomDetails(getRoom(member)).name} · {STATUS_LABEL[member.status]}
        </p>
        {isDemo ? (
          <>
            <p className="dialog-description">
              This is a sample teammate, not a real person online. Invite a guest to try a real
              video call.
            </p>
            <button className="primary-button" onClick={onConnectLive}>
              Connect live <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            {connected && !present && (
              <p className="dialog-description" role="status">
                This guest has left the workspace.
              </p>
            )}
            <button className="primary-button" disabled={!canCall} onClick={() => onCall(member)}>
              <Phone size={17} />
              Start a video call
            </button>
          </>
        )}
      </div>
    )}
  </Dialog>
);
