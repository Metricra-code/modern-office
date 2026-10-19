'use client';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { Call, CallPhase } from './use-call';
import type { LocalMedia } from './use-local-media';
import { VideoTile } from './video-tile';

const PHASE_DESCRIPTION: Record<Exclude<CallPhase, 'idle'>, string> = {
  incoming: 'Accept to share your camera and microphone. You are in control.',
  outgoing: 'Waiting for your teammate to accept…',
  connecting: 'Connecting directly with WebRTC…',
  active: 'Connected · Direct peer-to-peer video',
};

interface CallDialogProps {
  call: Call;
  media: LocalMedia;
  peerName?: string;
}
export const CallDialog = ({ call, media, peerName }: CallDialogProps) => (
  <Dialog
    open={call.phase !== 'idle'}
    title={
      call.phase === 'incoming'
        ? `${peerName ?? 'A guest'} is calling.`
        : `Call with ${peerName ?? 'your teammate'}`
    }
    onClose={call.end}
    wide
  >
    {call.phase !== 'idle' && (
      <p className="dialog-description" role="status">
        {PHASE_DESCRIPTION[call.phase]}
      </p>
    )}
    {call.phase === 'incoming' ? (
      <div className="call-actions">
        <button className="secondary-button" onClick={call.decline}>
          <PhoneOff size={17} />
          Decline
        </button>
        <button className="primary-button" onClick={() => void call.accept()}>
          <Phone size={17} />
          Accept call
        </button>
      </div>
    ) : (
      <>
        <div className="video-grid">
          <VideoTile stream={media.stream} muted label="You" cameraOff={media.cameraOff} />
          <VideoTile stream={call.remoteStream} label={peerName ?? 'Teammate'} />
        </div>
        <div className="call-actions">
          <button className="secondary-button" onClick={media.toggleMic}>
            {media.muted ? <MicOff size={18} /> : <Mic size={18} />}
            {media.muted ? 'Unmute' : 'Mute'}
          </button>
          <button className="secondary-button" onClick={media.toggleCamera}>
            {media.cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
            {media.cameraOff ? 'Turn camera on' : 'Turn camera off'}
          </button>
          <button className="danger-button" onClick={call.end}>
            <PhoneOff size={18} />
            End call
          </button>
        </div>
      </>
    )}
  </Dialog>
);
