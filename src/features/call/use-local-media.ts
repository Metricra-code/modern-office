'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const stopTracks = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());
const setTracksEnabled = (tracks: MediaStreamTrack[] = [], enabled: boolean): boolean => {
  tracks.forEach((track) => {
    track.enabled = enabled;
  });
  return tracks.length > 0;
};

export const useLocalMedia = () => {
  const [stream, setStream] = useState<MediaStream>();
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | undefined>(undefined);
  // Bumped by every capture and stop, so a slow permission prompt cannot revive a stale stream.
  const generation = useRef(0);

  const capture = useCallback(async (audio: boolean): Promise<MediaStream | undefined> => {
    generation.current += 1;
    const requestGeneration = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unsupported context');
      const next = await navigator.mediaDevices.getUserMedia({
        audio,
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (requestGeneration !== generation.current) {
        stopTracks(next);
        return;
      }
      stopTracks(streamRef.current);
      streamRef.current = next;
      setStream(next);
      setMuted(false);
      setCameraOff(false);
      setError('');
      return next;
    } catch {
      if (requestGeneration !== generation.current) return;
      setError(
        'Camera or microphone unavailable. Allow access in your browser, check your devices, and try again.',
      );
      return;
    }
  }, []);
  const stop = useCallback(() => {
    generation.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = undefined;
    setStream(undefined);
    setMuted(false);
    setCameraOff(false);
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
      stopTracks(streamRef.current);
    },
    [],
  );
  const toggleMic = () => {
    if (setTracksEnabled(streamRef.current?.getAudioTracks(), muted)) setMuted(!muted);
  };
  const toggleCamera = () => {
    if (setTracksEnabled(streamRef.current?.getVideoTracks(), cameraOff)) setCameraOff(!cameraOff);
  };
  const clearError = useCallback(() => setError(''), []);
  return {
    stream,
    muted,
    cameraOff,
    error,
    capture,
    stop,
    toggleMic,
    toggleCamera,
    clearError,
  };
};
export type LocalMedia = ReturnType<typeof useLocalMedia>;
