'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIMITS } from '@/lib/limits';
import {
  clientEventSchema,
  profileSchema,
  serverEventSchema,
  type Channel,
  type ChatMessage,
  type ClientEvent,
  type IncomingSignal,
  type Player,
  type PresenceStatus,
  type Profile,
  type ServerEvent,
  type Signal,
} from '@/lib/protocol';
import { readOfficeContext, writeOfficeContext, type OfficeMode } from '@/lib/routes';
import { isWalkable, type Point } from '@/lib/space';
import { DEFAULT_PLAYER, DEMO_MESSAGES, DEMO_PLAYERS } from './demo';

export type ConnectionState = 'demo' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
interface PendingChat {
  requestId: string;
  resolve: (delivered: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}
const HANDSHAKE_TIMEOUT_MS = 6000;
const CHAT_ACK_TIMEOUT_MS = 5000;
const MAX_RECONNECTS = 5;
export type SignalListener = (incoming: IncomingSignal) => void;

const realtimeUrl = (workspace: string, self: Profile): URL => {
  const endpoint =
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    (['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'ws://localhost:3101/office'
      : '/office');
  const url = new URL(endpoint, window.location.origin);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.searchParams.set('workspace', workspace);
  url.searchParams.set('name', self.name);
  url.searchParams.set('color', self.color);
  return url;
};
const appendMessage = (messages: ChatMessage[], message: ChatMessage): ChatMessage[] =>
  [...messages, message].slice(-LIMITS.history);

export const useOffice = () => {
  const [self, setSelf] = useState<Player>(DEFAULT_PLAYER);
  const selfRef = useRef<Player>(DEFAULT_PLAYER);
  const [peers, setPeers] = useState<Player[]>([...DEMO_PLAYERS]);
  // Read by receive, which runs before React renders the latest presence.
  const peersRef = useRef<readonly Player[]>(DEMO_PLAYERS);
  const [messages, setMessages] = useState<ChatMessage[]>([...DEMO_MESSAGES]);
  const [mode, setMode] = useState<OfficeMode>('demo');
  const [connection, setConnection] = useState<ConnectionState>('demo');
  const [workspace, setWorkspace] = useState('studio-team');
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const signalListeners = useRef(new Set<SignalListener>());
  const [retry, setRetry] = useState(0);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const pendingChat = useRef<PendingChat | undefined>(undefined);

  const finishChat = useCallback((delivered: boolean) => {
    const pending = pendingChat.current;
    pendingChat.current = undefined;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.resolve(delivered);
  }, []);
  const updateSelf = useCallback((next: Player) => {
    selfRef.current = next;
    setSelf(next);
  }, []);
  const updatePeers = useCallback((next: Player[]) => {
    peersRef.current = next;
    setPeers(next);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const context = readOfficeContext(
        window.location.search,
        process.env.NEXT_PUBLIC_DEFAULT_MODE === 'live' ? 'live' : 'demo',
      );
      setWorkspace(context.workspace);
      if (context.mode === 'live') {
        updateSelf({ ...selfRef.current, name: `Guest-${crypto.randomUUID().slice(0, 4)}` });
        updatePeers([]);
        setMessages([]);
        setMode('live');
        writeOfficeContext(context);
      }
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [updatePeers, updateSelf]);

  const receive = useCallback(
    (update: ServerEvent) => {
      if (
        (update.type === 'ack' || update.type === 'error') &&
        update.requestId === pendingChat.current?.requestId
      )
        finishChat(update.type === 'ack');
      switch (update.type) {
        case 'welcome': {
          const local = update.players.find((player) => player.id === update.selfId);
          if (local) updateSelf(local);
          updatePeers(update.players.filter((player) => player.id !== update.selfId));
          setMessages(update.messages);
          setConnection('connected');
          setError('');
          return;
        }
        case 'presence':
          updatePeers(update.players.filter((player) => player.id !== selfRef.current.id));
          return;
        case 'message':
          setMessages((previous) => appendMessage(previous, update.message));
          return;
        case 'error':
          setError(update.message);
          return;
        case 'signal':
          // Only guests in the latest presence may signal, even before React renders it.
          if (!peersRef.current.some((peer) => peer.id === update.from)) return;
          for (const listener of signalListeners.current)
            listener({ from: update.from, signal: update.signal });
          return;
      }
    },
    [finishChat, updatePeers, updateSelf],
  );

  useEffect(() => {
    if (mode !== 'live') return;
    let disposed = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let welcomeReceived = false;
    const connect = () => {
      if (disposed) return;
      welcomeReceived = false;
      setConnection(attempts ? 'reconnecting' : 'connecting');
      let socket: WebSocket;
      try {
        socket = new WebSocket(realtimeUrl(workspace, selfRef.current));
      } catch {
        setConnection('offline');
        setError('Check the realtime server URL, or return to the demo.');
        return;
      }
      socketRef.current = socket;
      timer = setTimeout(() => {
        if (!welcomeReceived) socket.close();
      }, HANDSHAKE_TIMEOUT_MS);
      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (disposed || typeof event.data !== 'string') return;
        let parsed;
        try {
          parsed = serverEventSchema.safeParse(JSON.parse(event.data));
        } catch {
          setError('An update could not be read. Please reconnect.');
          return;
        }
        if (!parsed.success) {
          setError('The server sent an unsupported update. Please reconnect.');
          return;
        }
        if (parsed.data.type === 'welcome') {
          clearTimeout(timer);
          welcomeReceived = true;
          attempts = 0;
        }
        receive(parsed.data);
      };
      socket.onerror = () => {
        if (!disposed) setError('Cannot reach the office server. Retrying automatically…');
      };
      socket.onclose = () => {
        clearTimeout(timer);
        if (disposed) return;
        finishChat(false);
        updatePeers([]);
        attempts += 1;
        if (attempts > MAX_RECONNECTS) {
          setConnection('offline');
          setError('The office is offline. Try reconnecting or explore the demo.');
          return;
        }
        setConnection('reconnecting');
        timer = setTimeout(connect, Math.min(1000 * 2 ** (attempts - 1), 10000));
      };
    };
    // Defer initial state updates; setup/cleanup remain symmetrical in Strict Mode.
    timer = setTimeout(connect, 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = undefined;
      finishChat(false);
    };
  }, [mode, workspace, retry, receive, finishChat, updatePeers]);

  const send = useCallback((event: ClientEvent): boolean => {
    if (!clientEventSchema.safeParse(event).success) return false;
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setError('Not connected yet. Your action was not sent.');
      return false;
    }
    try {
      socket.send(JSON.stringify(event));
      return true;
    } catch {
      setError('The connection closed before your action could be sent. Please reconnect.');
      return false;
    }
  }, []);
  // Live actions change local state only after the socket accepted them.
  const applyLocal = useCallback(
    (event: ClientEvent, next: Partial<Player>): boolean => {
      if (mode === 'live' && !send(event)) return false;
      updateSelf({ ...selfRef.current, ...next });
      return true;
    },
    [mode, send, updateSelf],
  );
  const move = useCallback(
    (point: Point): void => {
      if (isWalkable(point)) applyLocal({ type: 'move', ...point }, point);
    },
    [applyLocal],
  );
  const saveProfile = useCallback(
    (profile: Profile): boolean => {
      const parsed = profileSchema.safeParse(profile);
      if (!parsed.success) {
        setError(`Use a name between 1 and ${LIMITS.nameLength} characters.`);
        return false;
      }
      return applyLocal({ type: 'profile', ...parsed.data }, parsed.data);
    },
    [applyLocal],
  );
  const changeStatus = useCallback(
    (status: PresenceStatus): void => {
      applyLocal({ type: 'status', status }, { status });
    },
    [applyLocal],
  );
  const chat = useCallback(
    async (text: string, channel: Channel): Promise<boolean> => {
      const event = clientEventSchema.safeParse({ type: 'chat', text, channel });
      if (!event.success || event.data.type !== 'chat') {
        setError(`Write a message between 1 and ${LIMITS.messageLength} characters.`);
        return false;
      }
      const chatEvent = event.data;
      if (mode === 'live') {
        if (pendingChat.current) return false;
        const requestId = crypto.randomUUID();
        return new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            setError('Delivery was not confirmed. Your message is still in the composer.');
            finishChat(false);
          }, CHAT_ACK_TIMEOUT_MS);
          pendingChat.current = { requestId, resolve, timer };
          if (!send({ ...chatEvent, requestId })) finishChat(false);
        });
      }
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: selfRef.current.id,
        name: selfRef.current.name,
        color: selfRef.current.color,
        text: chatEvent.text,
        channel,
        sentAt: Date.now(),
      };
      setMessages((previous) => appendMessage(previous, message));
      return true;
    },
    [mode, send, finishChat],
  );
  const enterLive = useCallback(() => {
    finishChat(false);
    updatePeers([]);
    setMessages([]);
    setError('');
    setMode('live');
    setRetry((previous) => previous + 1);
    writeOfficeContext({ workspace, mode: 'live' });
  }, [workspace, finishChat, updatePeers]);
  const enterDemo = useCallback(() => {
    finishChat(false);
    setMode('demo');
    setConnection('demo');
    updatePeers([...DEMO_PLAYERS]);
    setMessages([...DEMO_MESSAGES]);
    setError('');
    updateSelf({ ...selfRef.current, id: DEFAULT_PLAYER.id });
    writeOfficeContext({ workspace, mode: 'demo' });
  }, [workspace, updateSelf, finishChat, updatePeers]);
  const sendSignal = useCallback(
    (target: string, signal: Signal): boolean => send({ type: 'signal', target, signal }),
    [send],
  );
  const subscribeSignals = useCallback((listener: SignalListener) => {
    signalListeners.current.add(listener);
    return () => {
      signalListeners.current.delete(listener);
    };
  }, []);
  const clearError = useCallback(() => setError(''), []);
  return {
    self,
    peers,
    messages,
    workspace,
    initialized,
    mode,
    connection,
    error,
    move,
    chat,
    saveProfile,
    changeStatus,
    enterLive,
    enterDemo,
    sendSignal,
    subscribeSignals,
    clearError,
  };
};
