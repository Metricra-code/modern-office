'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, VideoOff } from 'lucide-react';
export const VideoTile = ({
  stream,
  muted = false,
  label,
  cameraOff = false,
}: {
  stream?: MediaStream;
  muted?: boolean;
  label: string;
  cameraOff?: boolean;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream ?? null;
    if (stream) void video.play().catch(() => setNeedsPlay(true));
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <div className="video-tile">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-label={label}
        className={cameraOff ? 'video-hidden' : ''}
      />
      {(!stream || cameraOff) && (
        <span className="video-placeholder">
          <VideoOff size={27} />
          {cameraOff ? 'Camera off' : 'Waiting for video'}
        </span>
      )}
      {needsPlay && (
        <button
          className="video-play"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setNeedsPlay(false))
              .catch(() => setNeedsPlay(true))
          }
        >
          <Play size={20} />
          Play {label}
        </button>
      )}
      <span className="video-label">{label}</span>
    </div>
  );
};
