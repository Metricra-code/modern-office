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
import { LIMITS } from '../src/lib/limits';
import {
  messageSchema,
  playerSchema,
  workspaceSchema,
  type ServerEvent,
} from '../src/lib/protocol';
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

// Import platform types as a module, never into the browser's global DOM types.
declare const Response: typeof WorkerResponse;
declare const WebSocketPair: typeof WorkerWebSocketPair;

interface Environment {
  ASSETS: Fetcher;
  OFFICE: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}
// The hibernation attachment carries the guest's quota and last known player record.
const attachmentSchema = z.object({
  workspaceId: workspaceSchema,
  player: playerSchema,
  windowStart: z.number(),
  events: z.number().int().nonnegative(),
  lastChat: z.number(),
});
type Attachment = z.infer<typeof attachmentSchema>;
const historySchema = z.array(messageSchema).max(LIMITS.history);

const toGuest = ({ player, ...quota }: Attachment): Guest => ({ ...quota, id: player.id });

export default {
  async fetch(request: WorkerRequest, environment: Environment): Promise<WorkerResponse> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname !== '/office') return environment.ASSETS.fetch(request);
    const origins = [
      url.origin,
      ...(environment.ALLOWED_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? []),
    ];
    if (!origins.includes(request.headers.get('origin') ?? ''))
      return new Response('Origin not allowed', { status: 403 });
    if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    if (!parseHandshake(url)) return new Response('Invalid guest profile', { status: 400 });
    // One coordinator bounds the whole portfolio at 256 guests / 64 workspaces.
    return environment.OFFICE.getByName('office').fetch(request);
  },
} satisfies ExportedHandler<Environment>;

export class OfficeDurableObject {
  private readonly rooms = new OfficeRooms();
  private readonly guests = new Map<WorkerWebSocket, Attachment>();

  constructor(private readonly context: DurableObjectState) {
    this.context.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS history (workspace TEXT PRIMARY KEY, messages TEXT NOT NULL)',
    );
    this.restoreGuests();
  }

  private restoreGuests(): void {
    for (const socket of this.context.getWebSockets()) {
      const restored = attachmentSchema.safeParse(socket.deserializeAttachment());
      if (socket.readyState !== 1 || !restored.success) {
        socket.close(1008, 'Invalid session');
        continue;
      }
      this.guests.set(socket, restored.data);
    }
    const occupied = new Set([...this.guests.values()].map((guest) => guest.workspaceId));
    for (const workspaceId of occupied) {
      const players = [...this.guests.values()]
        .filter((guest) => guest.workspaceId === workspaceId)
        .map((guest) => guest.player);
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
      if (!occupied.has(row.workspace)) this.deleteHistory(row.workspace);
  }

  fetch(request: WorkerRequest): WorkerResponse {
    const handshake = parseHandshake(new URL(request.url));
    if (!handshake) return new Response('Invalid guest profile', { status: 400 });
    let player;
    try {
      player = this.rooms.join(handshake.workspaceId, handshake.profile);
    } catch {
      return new Response('Workspace unavailable or full', { status: 503 });
    }
    const guest = createGuest(player.id, handshake.workspaceId, Date.now());
    const pair = new WebSocketPair();
    this.context.acceptWebSocket(pair[1]);
    this.save(pair[1], guest);
    this.send(pair[1], welcome(this.rooms, guest));
    this.broadcast(guest.workspaceId, presence(this.rooms, guest.workspaceId));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(socket: WorkerWebSocket, raw: string | ArrayBuffer): void {
    const attachment = this.guests.get(socket);
    if (!attachment) {
      socket.close(1008, 'Unknown guest');
      return;
    }
    const outcome = handleMessage(this.rooms, toGuest(attachment), raw, Date.now(), (workspaceId) =>
      this.writeHistory(workspaceId),
    );
    this.save(socket, outcome.guest, attachment.player);
    for (const delivery of outcome.deliveries) this.deliver(socket, attachment, delivery);
    if (outcome.close) socket.close(outcome.close.code, outcome.close.reason);
  }

  webSocketClose(socket: WorkerWebSocket): void {
    this.remove(socket);
  }
  webSocketError(socket: WorkerWebSocket): void {
    this.remove(socket);
  }

  private deliver(socket: WorkerWebSocket, sender: Attachment, delivery: Delivery): void {
    if (delivery.to === 'self') this.send(socket, delivery.event);
    else if (delivery.to === 'workspace') this.broadcast(sender.workspaceId, delivery.event);
    else {
      const target = [...this.guests].find(([, guest]) => guest.player.id === delivery.id);
      if (target) this.send(target[0], delivery.event);
    }
  }

  private writeHistory(workspaceId: string): void {
    this.context.storage.sql.exec(
      'INSERT INTO history (workspace, messages) VALUES (?, ?) ON CONFLICT(workspace) DO UPDATE SET messages = excluded.messages',
      workspaceId,
      JSON.stringify(this.rooms.snapshot(workspaceId).messages),
    );
  }

  private deleteHistory(workspaceId: string): void {
    this.context.storage.sql.exec('DELETE FROM history WHERE workspace = ?', workspaceId);
  }

  // The attachment snapshots the domain player so hibernation can restore position and profile.
  private save(socket: WorkerWebSocket, { id, ...quota }: Guest, fallback?: Attachment['player']) {
    const player =
      this.rooms.snapshot(quota.workspaceId).players.find((guest) => guest.id === id) ?? fallback;
    if (!player) return;
    const attachment = { ...quota, player };
    this.guests.set(socket, attachment);
    socket.serializeAttachment(attachment);
  }

  private send(socket: WorkerWebSocket, event: ServerEvent): void {
    this.sendText(socket, JSON.stringify(event));
  }

  private sendText(socket: WorkerWebSocket, message: string): void {
    if (socket.readyState !== 1) return;
    try {
      socket.send(message);
    } catch {
      socket.close(1011, 'Connection unavailable');
    }
  }

  private broadcast(workspaceId: string, event: ServerEvent): void {
    const message = JSON.stringify(event);
    for (const [socket, guest] of this.guests)
      if (guest.workspaceId === workspaceId) this.sendText(socket, message);
  }

  private remove(socket: WorkerWebSocket): void {
    const guest = this.guests.get(socket);
    if (!guest) return;
    this.guests.delete(socket);
    this.rooms.leave(guest.player.id);
    if (this.rooms.snapshot(guest.workspaceId).players.length === 0)
      this.deleteHistory(guest.workspaceId);
    socket.close(1000, 'Guest left');
    this.broadcast(guest.workspaceId, presence(this.rooms, guest.workspaceId));
  }
}
