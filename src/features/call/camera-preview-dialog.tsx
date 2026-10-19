'use client';
import { Video, VideoOff } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { Call } from './use-call';
import { VideoTile } from './video-tile';

interface CameraPreviewDialogProps {
  open: boolean;
  call: Call;
  onClose: () => void;
}
export const CameraPreviewDialog = ({ open, call, onClose }: CameraPreviewDialogProps) => (
  <Dialog
    open={open && call.phase === 'idle'}
    title="Camera preview"
    onClose={() => {
      onClose();
      call.end();
    }}
  >
    <p className="dialog-description">
      Local preview only. Your microphone is not captured or shared.
    </p>
    <VideoTile
      stream={call.localStream}
      muted
      label="Your local preview"
      cameraOff={call.cameraOff}
    />
    <div className="call-actions">
      <button className="secondary-button" disabled={!call.localStream} onClick={call.toggleCamera}>
        {call.cameraOff ? <Video size={17} /> : <VideoOff size={17} />}Toggle camera
      </button>
      <button className="text-button" onClick={() => void call.preview()}>
        Retry camera
      </button>
    </div>
    <p className="form-error" role="status">
      {call.error}
    </p>
  </Dialog>
);
