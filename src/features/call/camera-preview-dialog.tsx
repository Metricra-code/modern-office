'use client';
import { Video, VideoOff } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { LocalMedia } from './use-local-media';
import { VideoTile } from './video-tile';

interface CameraPreviewDialogProps {
  open: boolean;
  media: LocalMedia;
  onClose: () => void;
}
export const CameraPreviewDialog = ({ open, media, onClose }: CameraPreviewDialogProps) => (
  <Dialog
    open={open}
    title="Camera preview"
    onClose={() => {
      onClose();
      media.stop();
    }}
  >
    <p className="dialog-description">
      Local preview only. Your microphone is not captured or shared.
    </p>
    <VideoTile stream={media.stream} muted label="Your local preview" cameraOff={media.cameraOff} />
    <div className="call-actions">
      <button className="secondary-button" disabled={!media.stream} onClick={media.toggleCamera}>
        {media.cameraOff ? <Video size={17} /> : <VideoOff size={17} />}Toggle camera
      </button>
      <button className="text-button" onClick={() => void media.capture(false)}>
        Retry camera
      </button>
    </div>
    <p className="form-error" role="status">
      {media.error}
    </p>
  </Dialog>
);
