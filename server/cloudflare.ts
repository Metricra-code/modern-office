import type {
  DurableObjectNamespace,
  DurableObjectState,
  ExportedHandler,
  Fetcher,
  Request as WorkerRequest,
  Response as WorkerResponse,
  WebSocket as WorkerWebSocket,
  WebSocketPair as WorkerWebSocketPair,
} from '@cloudflare/workers-types';
import { z } from 'zod';
import {
  clientEventSchema,
  messageSchema,
  playerSchema,
  profileSchema,
  workspaceSchema,
  type ClientEvent,
  type ServerEvent,
} from '../src/lib/protocol';
import { OfficeRooms } from './rooms';

// Import platform types as a module, never into the browser's global DOM types.
declare const Response: typeof WorkerResponse;
declare const WebSocketPair: typeof WorkerWebSocketPair;

interface Environment {
  ASSETS: Fetcher;
  OFFICE: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}
const connectionSchema = z.object({
  workspaceId: workspaceSchema,
  player: playerSchema,
  windowStart: z.number(),
  events: z.number().int().nonnegative(),
  lastChat: z.number(),
});
type Connection = z.infer<typeof connectionSchema>;
const historySchema = z.array(messageSchema).max(100);
const chatEnvelopeSchema = z.object({
  type: z.literal('chat'),
  requestId: z.string().uuid().optional(),
});
const encoder = new TextEncoder();

function parseHandshake(request: WorkerRequest) {
  const url = new URL(request.url);
  return {
    workspaceId: workspaceSchema.parse(url.searchParams.get('workspace')),
    profile: profileSchema.parse({
      name: url.searchParams.get('name'),
      color: url.searchParams.get('color'),
    }),
  };
}

export default {
  async fetch(request: WorkerRequest, environment: Environment): Promise<WorkerResponse> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname !== '/office') return environment.ASSETS.fetch(request);
    const origins = [
      url.origin,
      ...(environment.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? []),
    ];
    if (!origins.includes(request.headers.get('origin') ?? ''))
      return new Response('Origin not allowed', { status: 403 });
    if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    try {
      parseHandshake(request);
    } catch {
      return new Response('Invalid guest profile', { status: 400 });
    }
    // ponytail: one coordinator bounds the whole portfolio at 256 guests / 64 workspaces.
    return environment.OFFICE.getByName('office').fetch(request);
  },
} satisfies ExportedHandler<Environment>;

export class OfficeDurableObject {
  private readonly rooms = new OfficeRooms();
  private readonly connections = new Map<WorkerWebSocket, Connection>();

  constructor(private readonly context: DurableObjectState) {
    this.context.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS history (workspace TEXT PRIMARY KEY, messages TEXT NOT NULL)',
    );
    this.restoreConnections();
  }

  private restoreConnections(): void {
    for (const socket of this.context.getWebSockets()) {
      const restored = connectionSchema.safeParse(socket.deserializeAttachment());
      if (socket.readyState !== 1 || !restored.success) {
        socket.close(1008, 'Invalid session');
        continue;
      }
      this.connections.set(socket, restored.data);
    }
    const workspaces = new Set(
      [...this.connections.values()].map((connection) => connection.workspaceId),
    );
    for (const workspaceId of workspaces) {
      const players = [...this.connections.values()]
        .filter((connection) => connection.workspaceId === workspaceId)
        .map((connection) => connection.player);
      const row = this.context.storage.sql
        .exec<{ messages: string }>('SELECT messages FROM history WHERE workspace = ?', workspaceId)
        .toArray()[0];
      this.rooms.restore(workspaceId, {
        players,
        messages: row ? historySchema.parse(JSON.parse(row.messages)) : [],
      });
    }
    for (const row of this.context.storage.sql.exec<{ workspace: string }>(
      'SELECT workspace FROM history',
    ))
      if (!workspaces.has(row.workspace))
        this.context.storage.sql.exec('DELETE FROM history WHERE workspace = ?', row.workspace);
  }

  fetch(request: WorkerRequest): WorkerResponse {
    const { workspaceId, profile } = parseHandshake(request);
    let player;
    try {
      player = this.rooms.join(workspaceId, profile);
    } catch {
      return new Response('Workspace unavailable or full', { status: 503 });
    }
    const pair = new WebSocketPair();
    const connection: Connection = {
      workspaceId,
      player,
      windowStart: Date.now(),
      events: 0,
      lastChat: 0,
    };
    this.context.acceptWebSocket(pair[1]);
    this.connections.set(pair[1], connection);
    pair[1].serializeAttachment(connection);
    this.send(pair[1], { type: 'welcome', selfId: player.id, ...this.rooms.snapshot(workspaceId) });
    this.publishPresence(workspaceId);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(socket: WorkerWebSocket, raw: string | ArrayBuffer): void {
    const connection = this.connections.get(socket);
    if (!connection) {
      socket.close(1008, 'Unknown guest');
      return;
    }
    if (typeof raw !== 'string' || raw.length > 20_000 || encoder.encode(raw).byteLength > 20_000) {
      socket.close(1009, 'Message too large');
      return;
    }
    const now = Date.now();
    const updated =
      now - connection.windowStart >= 1000
        ? { ...connection, windowStart: now, events: 1 }
        : { ...connection, events: connection.events + 1 };
    this.saveConnection(socket, updated);
    if (updated.events > 40) {
      socket.close(1008, 'Too many messages');
      return;
    }
    let requestId: string | undefined;
    try {
      const incoming: unknown = JSON.parse(raw);
      const envelope = chatEnvelopeSchema.safeParse(incoming);
      requestId = envelope.success ? envelope.data.requestId : undefined;
      const event = clientEventSchema.parse(incoming);
      this.applyEvent(socket, updated, event);
    } catch {
      this.send(socket, {
        type: 'error',
        message: 'That action could not be completed. Please try again.',
        ...(requestId ? { requestId } : {}),
      });
    }
  }

  private applyEvent(socket: WorkerWebSocket, connection: Connection, event: ClientEvent): void {
    if (event.type === 'chat') {
      this.publishChat(socket, connection, event);
      return;
    }
    if (event.type === 'signal') {
      const target = [...this.connections].find(([, guest]) => guest.player.id === event.target);
      if (!target || !this.rooms.canSignal(connection.player.id, event.target))
        throw new Error('Invalid call target');
      this.send(target[0], { type: 'signal', from: connection.player.id, signal: event.signal });
      return;
    }
    if (event.type === 'move') this.rooms.move(connection.player.id, event);
    if (event.type === 'profile') this.rooms.profile(connection.player.id, event);
    if (event.type === 'status') this.rooms.status(connection.player.id, event.status);
    const player = this.rooms
      .snapshot(connection.workspaceId)
      .players.find((guest) => guest.id === connection.player.id);
    if (!player) throw new Error('Guest left');
    this.saveConnection(socket, { ...connection, player });
    this.publishPresence(connection.workspaceId);
  }

  private publishChat(
    socket: WorkerWebSocket,
    connection: Connection,
    event: Extract<ClientEvent, { type: 'chat' }>,
  ): void {
    if (Date.now() - connection.lastChat < 350) {
      this.send(socket, {
        type: 'error',
        message: 'Give your message a moment before sending another.',
        ...(event.requestId ? { requestId: event.requestId } : {}),
      });
      return;
    }
    const previous = this.rooms.snapshot(connection.workspaceId);
    const message = this.rooms.chat(connection.player.id, event);
    try {
      this.context.storage.sql.exec(
        'INSERT INTO history (workspace, messages) VALUES (?, ?) ON CONFLICT(workspace) DO UPDATE SET messages = excluded.messages',
        connection.workspaceId,
        JSON.stringify(this.rooms.snapshot(connection.workspaceId).messages),
      );
    } catch (error) {
      this.rooms.restore(connection.workspaceId, previous);
      throw error;
    }
    this.saveConnection(socket, { ...connection, lastChat: Date.now() });
    this.broadcast(connection.workspaceId, { type: 'message', message });
    if (event.requestId) this.send(socket, { type: 'ack', requestId: event.requestId });
  }

  private saveConnection(socket: WorkerWebSocket, connection: Connection): void {
    this.connections.set(socket, connection);
    socket.serializeAttachment(connection);
  }

  private send(socket: WorkerWebSocket, event: ServerEvent): void {
    if (socket.readyState !== 1) return;
    try {
      socket.send(JSON.stringify(event));
    } catch {
      socket.close(1011, 'Connection unavailable');
    }
  }

  private broadcast(workspaceId: string, event: ServerEvent): void {
    for (const [socket, connection] of this.connections)
      if (connection.workspaceId === workspaceId) this.send(socket, event);
  }

  private publishPresence(workspaceId: string): void {
    this.broadcast(workspaceId, {
      type: 'presence',
      players: this.rooms.snapshot(workspaceId).players,
    });
  }

  webSocketClose(socket: WorkerWebSocket): void {
    this.removeConnection(socket);
  }
  webSocketError(socket: WorkerWebSocket): void {
    this.removeConnection(socket);
  }

  private removeConnection(socket: WorkerWebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;
    this.connections.delete(socket);
    this.rooms.leave(connection.player.id);
    if (this.rooms.snapshot(connection.workspaceId).players.length === 0)
      this.context.storage.sql.exec(
        'DELETE FROM history WHERE workspace = ?',
        connection.workspaceId,
      );
    socket.close(1000, 'Guest left');
    this.publishPresence(connection.workspaceId);
  }
}
