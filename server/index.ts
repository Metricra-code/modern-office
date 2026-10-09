import type { ServerWebSocket } from 'bun';
import {
  clientEventSchema,
  profileSchema,
  workspaceSchema,
  type ServerEvent,
} from '../src/lib/protocol';
import { OfficeRooms } from './rooms';

interface GuestSocket {
  id: string;
  workspaceId: string;
  windowStart: number;
  events: number;
  lastChat: number;
}
const rooms = new OfficeRooms();
const sockets = new Map<string, ServerWebSocket<GuestSocket>>();
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? 'http://localhost:3100,http://127.0.0.1:3100'
)
  .split(',')
  .map((origin) => origin.trim());
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS)
  throw new Error('ALLOWED_ORIGINS is required in production');
const send = (socket: ServerWebSocket<GuestSocket>, event: ServerEvent): void => {
  socket.send(JSON.stringify(event));
};
const publishPresence = (workspaceId: string): void => {
  const event: ServerEvent = { type: 'presence', players: rooms.snapshot(workspaceId).players };
  server.publish(workspaceId, JSON.stringify(event));
};

const server = Bun.serve({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.REALTIME_PORT ?? 3101),
  fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname !== '/office') return new Response('Not found', { status: 404 });
    if (!allowedOrigins.includes(request.headers.get('origin') ?? ''))
      return new Response('Origin not allowed', { status: 403 });
    const workspace = workspaceSchema.safeParse(url.searchParams.get('workspace'));
    const profile = profileSchema.safeParse({
      name: url.searchParams.get('name'),
      color: url.searchParams.get('color'),
    });
    if (!workspace.success || !profile.success)
      return new Response('Invalid guest profile', { status: 400 });
    // Validate handshake before allocating an in-memory guest.
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    try {
      const player = rooms.join(workspace.data, profile.data);
      const upgraded = server.upgrade(request, {
        data: {
          id: player.id,
          workspaceId: workspace.data,
          windowStart: Date.now(),
          events: 0,
          lastChat: 0,
        },
      });
      if (!upgraded) {
        rooms.leave(player.id);
        return new Response('Upgrade failed', { status: 400 });
      }
    } catch {
      return new Response('Workspace unavailable or full', { status: 503 });
    }
  },
  websocket: {
    data: {} as GuestSocket,
    maxPayloadLength: 20000,
    idleTimeout: 120,
    sendPings: true,
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,
    open(socket) {
      sockets.set(socket.data.id, socket);
      socket.subscribe(socket.data.workspaceId);
      send(socket, {
        type: 'welcome',
        selfId: socket.data.id,
        ...rooms.snapshot(socket.data.workspaceId),
      });
      publishPresence(socket.data.workspaceId);
    },
    message(socket, raw) {
      const now = Date.now();
      if (now - socket.data.windowStart >= 1000) {
        socket.data.windowStart = now;
        socket.data.events = 0;
      }
      socket.data.events += 1;
      if (socket.data.events > 40) {
        socket.close(1008, 'Too many messages');
        return;
      }
      try {
        const event = clientEventSchema.parse(JSON.parse(String(raw)));
        if (event.type === 'chat') {
          if (now - socket.data.lastChat < 350) {
            send(socket, {
              type: 'error',
              message: 'Give your message a moment before sending another.',
              requestId: event.requestId,
            });
            return;
          }
          socket.data.lastChat = now;
          const message = rooms.chat(socket.data.id, event);
          if (event.requestId) send(socket, { type: 'ack', requestId: event.requestId });
          server.publish(
            socket.data.workspaceId,
            JSON.stringify({ type: 'message', message } satisfies ServerEvent),
          );
        } else if (event.type === 'signal') {
          if (!rooms.canSignal(socket.data.id, event.target))
            throw new Error('Invalid call target');
          const target = sockets.get(event.target);
          if (!target) throw new Error('Guest left');
          send(target, { type: 'signal', from: socket.data.id, signal: event.signal });
        } else {
          if (event.type === 'move') rooms.move(socket.data.id, event);
          if (event.type === 'profile') rooms.profile(socket.data.id, event);
          if (event.type === 'status') rooms.status(socket.data.id, event.status);
          publishPresence(socket.data.workspaceId);
        }
      } catch {
        send(socket, {
          type: 'error',
          message: 'That action could not be completed. Please try again.',
        });
      }
    },
    close(socket) {
      sockets.delete(socket.data.id);
      const workspaceId = rooms.leave(socket.data.id);
      if (workspaceId) publishPresence(workspaceId);
    },
  },
});
console.info(
  JSON.stringify({ event: 'realtime.started', port: server.port, mode: 'ephemeral-guest' }),
);
const shutdown = (): void => {
  server.stop(true);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
