import type { Signal } from '@/lib/protocol';

const MAX_QUEUED_CANDIDATES = 128;
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

export interface PeerSessionEvents {
  /** Sends a signal to the other guest; false when the socket refused it. */
  send: (signal: Signal) => boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onConnected: () => void;
  onLost: () => void;
}

/**
 * One RTCPeerConnection for one call. Methods resolve false when a reply could not be
 * sent, throw when the browser rejects an SDP or ICE step, and do nothing once closed.
 */
export class PeerSession {
  private readonly peer: RTCPeerConnection;
  private iceQueue: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(
    stream: MediaStream,
    private readonly callId: string,
    private readonly events: PeerSessionEvents,
  ) {
    const peer = new RTCPeerConnection({ iceServers: getIceServers() });
    this.peer = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = ({ candidate }) => {
      if (candidate && !this.closed)
        events.send({
          kind: 'ice',
          callId,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        });
    };
    peer.ontrack = (event) => {
      if (!this.closed && event.streams[0]) events.onRemoteStream(event.streams[0]);
    };
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      if (peer.connectionState === 'connected') events.onConnected();
      if (['failed', 'disconnected'].includes(peer.connectionState)) events.onLost();
    };
  }

  async offer(): Promise<boolean> {
    const offer = await this.peer.createOffer();
    if (this.closed) return true;
    await this.peer.setLocalDescription(offer);
    if (this.closed || !offer.sdp) return true;
    return this.events.send({ kind: 'offer', sdp: offer.sdp, callId: this.callId });
  }

  async receive(signal: Signal): Promise<boolean> {
    switch (signal.kind) {
      case 'ice': {
        const candidate = {
          candidate: signal.candidate,
          sdpMid: signal.sdpMid,
          sdpMLineIndex: signal.sdpMLineIndex,
        };
        if (this.peer.remoteDescription) await this.peer.addIceCandidate(candidate);
        else if (this.iceQueue.length < MAX_QUEUED_CANDIDATES) this.iceQueue.push(candidate);
        return true;
      }
      case 'offer': {
        if (this.peer.remoteDescription) return true;
        await this.peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        if (!(await this.flushIceQueue())) return true;
        const answer = await this.peer.createAnswer();
        if (this.closed) return true;
        await this.peer.setLocalDescription(answer);
        if (this.closed || !answer.sdp) return true;
        return this.events.send({ kind: 'answer', sdp: answer.sdp, callId: this.callId });
      }
      case 'answer':
        if (this.peer.signalingState !== 'have-local-offer') return true;
        await this.peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.flushIceQueue();
        return true;
      default:
        return true;
    }
  }

  close(): void {
    this.closed = true;
    this.peer.onconnectionstatechange = null;
    this.peer.onicecandidate = null;
    this.peer.ontrack = null;
    this.peer.close();
  }

  /** Applies candidates that arrived before the remote description; false once closed. */
  private async flushIceQueue(): Promise<boolean> {
    if (this.closed) return false;
    for (const candidate of this.iceQueue) {
      await this.peer.addIceCandidate(candidate);
      if (this.closed) return false;
    }
    this.iceQueue = [];
    return true;
  }
}
