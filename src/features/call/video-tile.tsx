'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const playVideo = useCallback((video: HTMLVideoElement) => {
    const source = video.srcObject;
    void video.play().catch(() => {
      // A replaced source's late rejection must not cover the current video.
      if (video.srcObject === source && video.paused) setNeedsPlay(true);
    });
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream ?? null;
    if (stream) playVideo(video);
    return () => {
      video.srcObject = null;
    };
  }, [stream, playVideo]);
  return (
    <div className="video-tile">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        onPlaying={() => setNeedsPlay(false)}
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
          onClick={() => {
            if (ref.current) playVideo(ref.current);
          }}
        >
          <Play size={20} />
          Play {label}
        </button>
      )}
      <span className="video-label">{label}</span>
    </div>
  );
};
