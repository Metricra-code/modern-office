'use client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { IncomingSignal, Signal } from '@/lib/protocol';
import { PeerSession } from './peer-session';
import type { LocalMedia } from './use-local-media';

export type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active';
const RING_TIMEOUT_MS = 30000;
const SETUP_FAILED = 'The call could not be established. Try again or use a different network.';
interface CallOptions {
  media: Pick<LocalMedia, 'capture' | 'stop'>;
  subscribeSignals: (listener: (incoming: IncomingSignal) => void) => () => void;
  connected: boolean;
  peers: readonly { id: string }[];
  send: (target: string, signal: Signal) => boolean;
}
export const useCall = ({ media, subscribeSignals, connected, peers, send }: CallOptions) => {
  const { capture, stop: stopMedia } = media;
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [target, setTarget] = useState('');
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [error, setError] = useState('');
  const sessionRef = useRef<PeerSession | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const targetRef = useRef('');
  const callIdRef = useRef('');
  const phaseRef = useRef<CallPhase>('idle');
  const generation = useRef(0);
  const signalChain = useRef<Promise<void>>(Promise.resolve());

  const transition = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const cleanup = useCallback(() => {
    generation.current += 1;
    // A cancelled SDP promise cannot block signals for the next call.
    signalChain.current = Promise.resolve();
    sessionRef.current?.close();
    sessionRef.current = undefined;
    streamRef.current = undefined;
    stopMedia();
    targetRef.current = '';
    callIdRef.current = '';
    setRemoteStream(undefined);
    setTarget('');
    transition('idle');
  }, [stopMedia, transition]);
  const end = useCallback(() => {
    if (targetRef.current && connected)
      send(targetRef.current, { kind: 'end', callId: callIdRef.current });
    cleanup();
  }, [cleanup, connected, send]);
  /** Captures camera and microphone for this call; undefined when the call moved on or failed. */
  const captureForCall = useCallback(
    async (onFailure: () => void): Promise<MediaStream | undefined> => {
      const callGeneration = generation.current;
      const stream = await capture(true);
      if (callGeneration !== generation.current) return;
      // Media reports why capture failed; the call only has to give up.
      if (!stream) {
        onFailure();
        return;
      }
      streamRef.current = stream;
      setError('');
      return stream;
    },
    [capture],
  );
  const openSession = useCallback((): PeerSession => {
    const peerTarget = targetRef.current;
    const session = new PeerSession(streamRef.current!, callIdRef.current, {
      send: (signal) => send(peerTarget, signal),
      onRemoteStream: setRemoteStream,
      onConnected: () => transition('active'),
      onLost: () => {
        setError(
          'The call connection was lost. This network may need a TURN relay; chat still works.',
        );
        end();
      },
    });
    sessionRef.current = session;
    return session;
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
      if (!(await captureForCall(cleanup))) return;
      if (!send(id, { kind: 'invite', callId })) cleanup();
    },
    [captureForCall, cleanup, connected, send, transition],
  );
  const accept = useCallback(async (): Promise<void> => {
    if (phaseRef.current !== 'incoming') return;
    transition('connecting');
    if (!(await captureForCall(end))) return;
    try {
      openSession();
      if (!send(targetRef.current, { kind: 'accept', callId: callIdRef.current })) end();
    } catch {
      setError(SETUP_FAILED);
      end();
    }
  }, [captureForCall, openSession, end, send, transition]);
  const decline = useCallback(() => {
    if (targetRef.current) send(targetRef.current, { kind: 'decline', callId: callIdRef.current });
    cleanup();
  }, [cleanup, send]);

  const ring = (from: string, callId: string) => {
    if (phaseRef.current !== 'idle') {
      if (from !== targetRef.current || callId !== callIdRef.current)
        send(from, { kind: 'decline', callId });
      return;
    }
    generation.current += 1;
    callIdRef.current = callId;
    targetRef.current = from;
    setTarget(from);
    transition('incoming');
  };
  const negotiate = async (signal: Signal): Promise<void> => {
    const callGeneration = generation.current;
    const isCurrentCall = () => callGeneration === generation.current;
    try {
      let session = sessionRef.current;
      if (signal.kind === 'accept') {
        if (phaseRef.current !== 'outgoing') return;
        transition('connecting');
        session = openSession();
        if (!(await session.offer())) end();
        return;
      }
      if (signal.kind === 'offer' && phaseRef.current !== 'connecting') return;
      if (session && !(await session.receive(signal))) end();
    } catch {
      if (!isCurrentCall()) return;
      setError(SETUP_FAILED);
      end();
    }
  };
  const handleSignal = useEffectEvent(async ({ from, signal }: IncomingSignal): Promise<void> => {
    if (signal.kind === 'invite') {
      ring(from, signal.callId);
      return;
    }
    if (from !== targetRef.current || signal.callId !== callIdRef.current) return;
    if (signal.kind === 'decline' || signal.kind === 'end') cleanup();
    else await negotiate(signal);
  });
  const dispatchSignal = useEffectEvent((event: IncomingSignal) => {
    if (['invite', 'end', 'decline'].includes(event.signal.kind)) {
      // Consent and hangup must not wait for an earlier browser SDP operation.
      void handleSignal(event);
      return;
    }
    // SDP and ICE must run in arrival order, one browser operation at a time.
    const queuedGeneration = generation.current;
    signalChain.current = signalChain.current.then(async () => {
      if (queuedGeneration === generation.current) await handleSignal(event);
    });
  });
  useEffect(() => subscribeSignals((event) => dispatchSignal(event)), [subscribeSignals]);
  useEffect(() => {
    if (phase === 'idle' || phase === 'active') return;
    const timeout = setTimeout(() => {
      setError('No answer or connection timed out. Try again when your teammate is ready.');
      end();
    }, RING_TIMEOUT_MS);
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
      sessionRef.current?.close();
    },
    [],
  );
  return {
    phase,
    target,
    remoteStream,
    error,
    start,
    accept,
    decline,
    end,
    clearError: () => setError(''),
  };
};
export type Call = ReturnType<typeof useCall>;
