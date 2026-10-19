import type { ServerWebSocket } from 'bun';
import { LIMITS } from '../src/lib/limits';
import type { ServerEvent } from '../src/lib/protocol';
import { OfficeRooms } from './rooms';
import {
  createGuest,
  handleMessage,
  parseHandshake,
  presence,
  welcome,
  type Delivery,
  type Guest,
} from './session';

const rooms = new OfficeRooms();
const sockets = new Map<string, ServerWebSocket<Guest>>();
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? 'http://localhost:3100,http://127.0.0.1:3100'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS)
  throw new Error('ALLOWED_ORIGINS is required in production');

const send = (socket: ServerWebSocket<Guest> | undefined, event: ServerEvent): void => {
  socket?.send(JSON.stringify(event));
};
const deliver = (socket: ServerWebSocket<Guest>, delivery: Delivery): void => {
  if (delivery.to === 'self') send(socket, delivery.event);
  else if (delivery.to === 'guest') send(sockets.get(delivery.id), delivery.event);
  else server.publish(socket.data.workspaceId, JSON.stringify(delivery.event));
};
const publishPresence = (workspaceId: string): void => {
  server.publish(workspaceId, JSON.stringify(presence(rooms, workspaceId)));
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
    const handshake = parseHandshake(url);
    if (!handshake) return new Response('Invalid guest profile', { status: 400 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    try {
      const player = rooms.join(handshake.workspaceId, handshake.profile);
      const data = createGuest(player.id, handshake.workspaceId, Date.now());
      if (!server.upgrade(request, { data })) {
        rooms.leave(player.id);
        return new Response('Upgrade failed', { status: 400 });
      }
    } catch {
      return new Response('Workspace unavailable or full', { status: 503 });
    }
  },
  websocket: {
    data: {} as Guest,
    maxPayloadLength: LIMITS.payloadBytes,
    idleTimeout: 120,
    sendPings: true,
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,
    open(socket) {
      sockets.set(socket.data.id, socket);
      socket.subscribe(socket.data.workspaceId);
      send(socket, welcome(rooms, socket.data));
      publishPresence(socket.data.workspaceId);
    },
    message(socket, raw) {
      const outcome = handleMessage(rooms, socket.data, String(raw), Date.now());
      socket.data = outcome.guest;
      for (const delivery of outcome.deliveries) deliver(socket, delivery);
      if (outcome.close) socket.close(outcome.close.code, outcome.close.reason);
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
