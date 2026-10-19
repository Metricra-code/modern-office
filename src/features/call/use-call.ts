'use client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { IncomingSignal, Signal } from '@/lib/protocol';

export type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active';
interface CallOptions {
  incoming: readonly IncomingSignal[];
  connected: boolean;
  peers: readonly { id: string }[];
  send: (target: string, signal: Signal) => boolean;
}
const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.NEXT_PUBLIC_TURN_URL)
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  return servers;
};
export const useCall = ({ incoming, connected, peers, send }: CallOptions) => {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [target, setTarget] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');
  const peerRef = useRef<RTCPeerConnection | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const targetRef = useRef('');
  const callIdRef = useRef('');
  const phaseRef = useRef<CallPhase>('idle');
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const generation = useRef(0);
  const processedSequence = useRef(0);
  const signalChain = useRef<Promise<void>>(Promise.resolve());

  const transition = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const cleanup = useCallback(() => {
    generation.current += 1;
    // A cancelled SDP promise cannot block signals for the next call.
    signalChain.current = Promise.resolve();
    const peer = peerRef.current;
    peerRef.current = undefined;
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    targetRef.current = '';
    callIdRef.current = '';
    iceQueue.current = [];
    setLocalStream(undefined);
    setRemoteStream(undefined);
    setTarget('');
    setMuted(false);
    setCameraOff(false);
    transition('idle');
  }, [transition]);
  const end = useCallback(() => {
    if (targetRef.current && connected)
      send(targetRef.current, { kind: 'end', callId: callIdRef.current });
    cleanup();
  }, [cleanup, connected, send]);
  const capture = useCallback(async (audio: boolean): Promise<MediaStream | undefined> => {
    const requestGeneration = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unsupported context');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (requestGeneration !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setLocalStream(stream);
      setMuted(false);
      setCameraOff(false);
      setError('');
      return stream;
    } catch {
      if (requestGeneration !== generation.current) return;
      setError(
        'Camera or microphone unavailable. Allow access in your browser, check your devices, and try again.',
      );
      return;
    }
  }, []);
  const createPeer = useCallback((): RTCPeerConnection => {
    const peer = new RTCPeerConnection({ iceServers: getIceServers() });
    peerRef.current = peer;
    const peerGeneration = generation.current;
    const peerTarget = targetRef.current;
    const peerCallId = callIdRef.current;
    const isCurrentPeer = () =>
      peerGeneration === generation.current &&
      peerRef.current === peer &&
      peerTarget === targetRef.current &&
      peerCallId === callIdRef.current;
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current!));
    peer.onicecandidate = ({ candidate }) => {
      if (candidate && isCurrentPeer())
        send(peerTarget, {
          kind: 'ice',
          callId: peerCallId,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        });
    };
    peer.ontrack = (event) => {
      if (isCurrentPeer() && event.streams[0]) setRemoteStream(event.streams[0]);
    };
    peer.onconnectionstatechange = () => {
      if (!isCurrentPeer()) return;
      if (peer.connectionState === 'connected') transition('active');
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        setError(
          'The call connection was lost. This network may need a TURN relay; chat still works.',
        );
        end();
      }
    };
    return peer;
  }, [end, send, transition]);
  const start = useCallback(
    async (id: string): Promise<void> => {
      if (!connected || phaseRef.current !== 'idle') {
        setError('Connect live first. Only one call can be active at a time.');
        return;
      }
      generation.current += 1;
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      targetRef.current = id;
      setTarget(id);
      transition('outgoing');
      const callGeneration = generation.current;
      const stream = await capture(true);
      if (callGeneration !== generation.current) return;
      if (!stream) {
        cleanup();
        return;
      }
      if (!send(id, { kind: 'invite', callId })) cleanup();
    },
    [capture, cleanup, connected, send, transition],
  );
  const accept = useCallback(async (): Promise<void> => {
    if (phaseRef.current !== 'incoming') return;
    transition('connecting');
    const callGeneration = generation.current;
    const stream = await capture(true);
    if (callGeneration !== generation.current) return;
    if (!stream) {
      end();
      return;
    }
    try {
      createPeer();
      if (!send(targetRef.current, { kind: 'accept', callId: callIdRef.current })) end();
    } catch {
      setError('The call could not be established. Try again or use a different network.');
      end();
    }
  }, [capture, createPeer, end, send, transition]);
  const decline = useCallback(() => {
    if (targetRef.current) send(targetRef.current, { kind: 'decline', callId: callIdRef.current });
    cleanup();
  }, [cleanup, send]);

  const handleSignal = useEffectEvent(async (event: IncomingSignal): Promise<void> => {
    const { from, signal } = event;
    if (!connected) return;
    if (signal.kind === 'invite') {
      if (!peers.some((peer) => peer.id === from)) return;
      if (phaseRef.current !== 'idle') {
        if (from !== targetRef.current || signal.callId !== callIdRef.current)
          send(from, { kind: 'decline', callId: signal.callId });
        return;
      }
      generation.current += 1;
      callIdRef.current = signal.callId;
      targetRef.current = from;
      setTarget(from);
      transition('incoming');
      return;
    }
    if (from !== targetRef.current || signal.callId !== callIdRef.current) return;
    if (signal.kind === 'decline' || signal.kind === 'end') {
      cleanup();
      return;
    }
    const callGeneration = generation.current;
    const isCurrentCall = () =>
      callGeneration === generation.current &&
      from === targetRef.current &&
      signal.callId === callIdRef.current;
    try {
      if (signal.kind === 'accept' && phaseRef.current === 'outgoing') {
        transition('connecting');
        const peer = createPeer();
        const offer = await peer.createOffer();
        if (!isCurrentCall()) return;
        await peer.setLocalDescription(offer);
        if (!isCurrentCall()) return;
        if (offer.sdp && !send(from, { kind: 'offer', sdp: offer.sdp, callId: signal.callId }))
          end();
      }
      const peer = peerRef.current;
      if (signal.kind === 'ice') {
        const candidate = {
          candidate: signal.candidate,
          sdpMid: signal.sdpMid,
          sdpMLineIndex: signal.sdpMLineIndex,
        };
        if (peer?.remoteDescription) await peer.addIceCandidate(candidate);
        else if (iceQueue.current.length < 128) iceQueue.current.push(candidate);
      }
      if (
        signal.kind === 'offer' &&
        peer &&
        phaseRef.current === 'connecting' &&
        !peer.remoteDescription
      ) {
        await peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        if (!isCurrentCall()) return;
        for (const candidate of iceQueue.current) {
          await peer.addIceCandidate(candidate);
          if (!isCurrentCall()) return;
        }
        iceQueue.current = [];
        const answer = await peer.createAnswer();
        if (!isCurrentCall()) return;
        await peer.setLocalDescription(answer);
        if (!isCurrentCall()) return;
        if (answer.sdp && !send(from, { kind: 'answer', sdp: answer.sdp, callId: signal.callId }))
          end();
      }
      if (signal.kind === 'answer' && peer?.signalingState === 'have-local-offer') {
        await peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        if (!isCurrentCall()) return;
        for (const candidate of iceQueue.current) {
          await peer.addIceCandidate(candidate);
          if (!isCurrentCall()) return;
        }
        iceQueue.current = [];
      }
    } catch {
      if (!isCurrentCall()) return;
      setError('The call could not be established. Try again or use a different network.');
      end();
    }
  });
  useEffect(() => {
    // React may batch several ICE messages. Keep every event and process SDP/ICE
    // in arrival order rather than overwriting a single "latest signal" state.
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      for (const event of incoming) {
        if (event.sequence <= processedSequence.current) continue;
        processedSequence.current = event.sequence;
        if (['invite', 'end', 'decline'].includes(event.signal.kind)) {
          // Consent and hangup must not wait for an earlier browser SDP operation.
          void handleSignal(event);
        } else {
          const queuedGeneration = generation.current;
          signalChain.current = signalChain.current.then(async () => {
            if (queuedGeneration === generation.current) await handleSignal(event);
          });
        }
      }
    });
    return () => {
      disposed = true;
    };
  }, [incoming]);
  useEffect(() => {
    if (phase === 'idle' || phase === 'active') return;
    const timeout = setTimeout(() => {
      setError('No answer or connection timed out. Try again when your teammate is ready.');
      end();
    }, 30000);
    return () => clearTimeout(timeout);
  }, [phase, end]);
  const handleDisconnect = useEffectEvent(() => {
    if (phaseRef.current !== 'idle') {
      setError('The office disconnected, so the call has ended.');
      cleanup();
    }
  });
  useEffect(() => {
    if (!connected) handleDisconnect();
  }, [connected]);
  const handlePeerDeparture = useEffectEvent(() => {
    if (connected && targetRef.current && !peers.some((peer) => peer.id === targetRef.current)) {
      setError('Your teammate left the office, so the call has ended.');
      cleanup();
    }
  });
  useEffect(() => {
    handlePeerDeparture();
  }, [peers, connected]);
  useEffect(
    () => () => {
      generation.current += 1;
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  const setTracksEnabled = (tracks: MediaStreamTrack[] = [], enabled: boolean): boolean => {
    tracks.forEach((track) => {
      track.enabled = enabled;
    });
    return tracks.length > 0;
  };
  const toggleMic = () => {
    if (setTracksEnabled(streamRef.current?.getAudioTracks(), muted)) setMuted(!muted);
  };
  const toggleCamera = () => {
    if (setTracksEnabled(streamRef.current?.getVideoTracks(), cameraOff)) setCameraOff(!cameraOff);
  };
  const preview = async () => {
    if (phaseRef.current !== 'idle') return;
    generation.current += 1;
    await capture(false);
  };
  return {
    phase,
    target,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    error,
    start,
    accept,
    decline,
    end,
    preview,
    toggleMic,
    toggleCamera,
    clearError: () => setError(''),
  };
};
export type Call = ReturnType<typeof useCall>;
