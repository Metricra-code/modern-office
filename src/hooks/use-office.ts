'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_MESSAGES, DEMO_PLAYERS, DEFAULT_PLAYER } from '@/lib/demo';
import {
  clientEventSchema,
  profileSchema,
  serverEventSchema,
  workspaceSchema,
  type Channel,
  type ChatMessage,
  type ClientEvent,
  type Player,
  type PresenceStatus,
  type Profile,
  type Signal,
} from '@/lib/protocol';
import { isWalkable, type Point } from '@/lib/space';

export type ConnectionState = 'demo' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
export interface IncomingSignal {
  from: string;
  signal: Signal;
  sequence: number;
}
export const useOffice = () => {
  const [self, setSelf] = useState<Player>(DEFAULT_PLAYER);
  const selfRef = useRef<Player>(DEFAULT_PLAYER);
  const [peers, setPeers] = useState<Player[]>([...DEMO_PLAYERS]);
  const [messages, setMessages] = useState<ChatMessage[]>([...DEMO_MESSAGES]);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [connection, setConnection] = useState<ConnectionState>('demo');
  const [workspace, setWorkspace] = useState('studio-team');
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const [signal, setSignal] = useState<IncomingSignal[]>([]);
  const signalSequence = useRef(0);
  const [retry, setRetry] = useState(0);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const pendingChat = useRef<
    | {
        requestId: string;
        resolve: (delivered: boolean) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined
  >(undefined);
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const parsed = workspaceSchema.safeParse(params.get('workspace'));
      const workspaceId = parsed.success
        ? parsed.data
        : `office-${crypto.randomUUID().slice(0, 8)}`;
      setWorkspace(workspaceId);
      const live =
        params.get('mode') === 'live' ||
        (params.get('mode') !== 'demo' && process.env.NEXT_PUBLIC_DEFAULT_MODE === 'live');
      if (live) {
        updateSelf({ ...selfRef.current, name: `Guest-${crypto.randomUUID().slice(0, 4)}` });
        setPeers([]);
        setMessages([]);
        setMode('live');
        const url = new URL(window.location.href);
        url.searchParams.set('workspace', workspaceId);
        url.searchParams.set('mode', 'live');
        window.history.replaceState({}, '', url);
      }
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [updateSelf]);

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
      const endpoint =
        process.env.NEXT_PUBLIC_REALTIME_URL ??
        (['localhost', '127.0.0.1'].includes(window.location.hostname)
          ? 'ws://localhost:3101/office'
          : '/office');
      let socket: WebSocket;
      try {
        const url = new URL(endpoint, window.location.origin);
        url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
        url.searchParams.set('workspace', workspace);
        url.searchParams.set('name', selfRef.current.name);
        url.searchParams.set('color', selfRef.current.color);
        socket = new WebSocket(url);
      } catch {
        setConnection('offline');
        setError('Check the realtime server URL, or return to the demo.');
        return;
      }
      socketRef.current = socket;
      // A handshake deadline avoids an indefinitely spinning UI.
      timer = setTimeout(() => {
        if (!welcomeReceived) socket.close();
      }, 6000);
      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (disposed || typeof event.data !== 'string') return;
        try {
          const parsed = serverEventSchema.safeParse(JSON.parse(event.data));
          if (!parsed.success) {
            setError('The server sent an unsupported update. Please reconnect.');
            return;
          }
          const update = parsed.data;
          if (
            (update.type === 'ack' || update.type === 'error') &&
            update.requestId === pendingChat.current?.requestId
          )
            finishChat(update.type === 'ack');
          if (update.type === 'welcome') {
            clearTimeout(timer);
            welcomeReceived = true;
            attempts = 0;
            const local = update.players.find((player) => player.id === update.selfId);
            if (local) updateSelf(local);
            setPeers(update.players.filter((player) => player.id !== update.selfId));
            setMessages(update.messages);
            setConnection('connected');
            setError('');
          }
          if (update.type === 'presence')
            setPeers(update.players.filter((player) => player.id !== selfRef.current.id));
          if (update.type === 'message')
            setMessages((previous) => [...previous, update.message].slice(-100));
          if (update.type === 'error') setError(update.message);
          if (update.type === 'signal') {
            signalSequence.current += 1;
            const incoming = {
              from: update.from,
              signal: update.signal,
              sequence: signalSequence.current,
            };
            setSignal((previous) => [...previous, incoming].slice(-128));
          }
        } catch {
          setError('An update could not be read. Please reconnect.');
        }
      };
      socket.onerror = () => {
        if (!disposed) setError('Cannot reach the office server. Retrying automatically…');
      };
      socket.onclose = () => {
        clearTimeout(timer);
        if (disposed) return;
        finishChat(false);
        setPeers([]);
        attempts += 1;
        if (attempts > 5) {
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
  }, [mode, workspace, retry, updateSelf, finishChat]);

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
  const move = useCallback(
    (point: Point): void => {
      if (!isWalkable(point)) return;
      if (mode === 'live' && !send({ type: 'move', ...point })) return;
      updateSelf({ ...selfRef.current, ...point });
    },
    [mode, send, updateSelf],
  );
  const saveProfile = useCallback(
    (profile: Profile): boolean => {
      const parsed = profileSchema.safeParse(profile);
      if (!parsed.success) {
        setError('Use a name between 1 and 24 characters.');
        return false;
      }
      if (mode === 'live' && !send({ type: 'profile', ...parsed.data })) return false;
      updateSelf({ ...selfRef.current, ...parsed.data });
      return true;
    },
    [mode, send, updateSelf],
  );
  const changeStatus = useCallback(
    (status: PresenceStatus): void => {
      if (mode === 'live' && !send({ type: 'status', status })) return;
      updateSelf({ ...selfRef.current, status });
    },
    [mode, send, updateSelf],
  );
  const chat = useCallback(
    async (text: string, channel: Channel): Promise<boolean> => {
      const event = clientEventSchema.safeParse({ type: 'chat', text, channel });
      if (!event.success || event.data.type !== 'chat') {
        setError('Write a message between 1 and 500 characters.');
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
          }, 5000);
          pendingChat.current = { requestId, resolve, timer };
          if (!send({ ...chatEvent, requestId })) finishChat(false);
        });
      }
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: 'local',
        name: selfRef.current.name,
        color: selfRef.current.color,
        text: chatEvent.text,
        channel,
        sentAt: Date.now(),
      };
      setMessages((previous) => [...previous, message].slice(-100));
      return true;
    },
    [mode, send, finishChat],
  );
  const enterLive = useCallback(() => {
    finishChat(false);
    setPeers([]);
    setMessages([]);
    setError('');
    setMode('live');
    setRetry((previous) => previous + 1);
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', workspace);
    url.searchParams.set('mode', 'live');
    window.history.replaceState({}, '', url);
  }, [workspace, finishChat]);
  const enterDemo = useCallback(() => {
    finishChat(false);
    setMode('demo');
    setConnection('demo');
    setPeers([...DEMO_PLAYERS]);
    setMessages([...DEMO_MESSAGES]);
    setError('');
    updateSelf({ ...selfRef.current, id: 'local' });
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'demo');
    window.history.replaceState({}, '', url);
  }, [updateSelf, finishChat]);
  const sendSignal = useCallback(
    (target: string, signal: Signal): boolean => send({ type: 'signal', target, signal }),
    [send],
  );
  return {
    self,
    peers,
    messages,
    workspace,
    initialized,
    mode,
    connection,
    error,
    signal,
    move,
    chat,
    saveProfile,
    changeStatus,
    enterLive,
    enterDemo,
    sendSignal,
    clearError: () => setError(''),
  };
};
