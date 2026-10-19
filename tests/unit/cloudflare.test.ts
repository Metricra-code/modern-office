import { describe, expect, spyOn, test } from 'bun:test';
import { OfficeRooms } from '../../server/rooms';
import { isWalkable } from '../../src/lib/space';

const profile = { name: 'Guest', color: 'sage' as const };
describe('cloud office restart and admission', () => {
  test('keeps new guests separated so avatar actions remain clickable', () => {
    const rooms = new OfficeRooms();
    const players = Array.from({ length: 32 }, () => rooms.join('alpha', profile));
    expect(new Set(players.map(({ x, y }) => `${x},${y}`)).size).toBe(32);
    expect(players.every(isWalkable)).toBe(true);
    expect(
      players.every((player, index) =>
        players
          .slice(index + 1)
          .every((other) => Math.hypot(player.x - other.x, player.y - other.y) >= 50),
      ),
    ).toBe(true);
  });
  test('restores server identities, positions and bounded history after hibernation', () => {
    const before = new OfficeRooms();
    const player = before.join('alpha', profile);
    before.move(player.id, { x: 570, y: 140 });
    before.status(player.id, 'focus');
    before.chat(player.id, { text: 'Still here', channel: 'general' });
    const after = new OfficeRooms();
    after.restore('alpha', before.snapshot('alpha'));
    expect(after.snapshot('alpha')).toEqual(before.snapshot('alpha'));
    expect(after.workspaceOf(player.id)).toBe('alpha');
    after.leave(player.id);
    expect(after.snapshot('alpha')).toEqual({ players: [], messages: [] });
  });
});

import { Database } from 'bun:sqlite';
import type {
  DurableObjectState,
  Request as WorkerRequest,
  WebSocket as WorkerWebSocket,
} from '@cloudflare/workers-types';
import worker, { OfficeDurableObject } from '../../server/cloudflare';
import { serverEventSchema, type Player, type ServerEvent } from '../../src/lib/protocol';

function createSocket(player: Player, workspaceId = 'alpha') {
  let attachment: unknown = {
    workspaceId,
    player,
    windowStart: Date.now(),
    events: 0,
    lastChat: 0,
  };
  const events: ServerEvent[] = [];
  const socket = {
    readyState: 1,
    closeCode: 0,
    close(code: number) {
      socket.readyState = 3;
      socket.closeCode = code;
    },
    send(raw: string) {
      events.push(serverEventSchema.parse(JSON.parse(raw)));
    },
    deserializeAttachment: () => structuredClone(attachment),
    serializeAttachment(value: unknown) {
      attachment = structuredClone(value);
    },
  };
  return {
    socket: socket as unknown as WorkerWebSocket,
    events,
    closeCode: () => socket.closeCode,
  };
}

function createContext(sockets: WorkerWebSocket[]) {
  const database = new Database(':memory:');
  const context = {
    getWebSockets: () => sockets,
    storage: {
      sql: {
        exec(statement: string, ...bindings: (string | number)[]) {
          const rows = database.query(statement).all(...bindings);
          return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator]() };
        },
      },
    },
  };
  return { context: context as unknown as DurableObjectState, database };
}

function createOffice() {
  const rooms = new OfficeRooms();
  const first = createSocket(rooms.join('alpha', profile));
  const second = createSocket(rooms.join('alpha', profile));
  const outsider = createSocket(rooms.join('beta', profile), 'beta');
  const state = createContext([first.socket, second.socket, outsider.socket]);
  const office = new OfficeDurableObject(state.context);
  return { ...state, office, first, second, outsider };
}

describe('Cloudflare transport boundaries and hibernation', () => {
  test('rejects foreign origins and invalid handshakes before allocating an object', async () => {
    const environment = { ASSETS: {}, OFFICE: {} } as unknown as Parameters<typeof worker.fetch>[1];
    const request = (query: string, origin: string) =>
      new Request(`https://office.example/office?${query}`, {
        headers: { origin, upgrade: 'websocket' },
      }) as unknown as WorkerRequest;
    expect(
      (
        await worker.fetch(
          request('workspace=alpha&name=Guest&color=sage', 'https://evil.example'),
          environment,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          request('workspace=bad!&name=Guest&color=sage', 'https://office.example'),
          environment,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await worker.fetch(
          new Request('https://office.example/health') as unknown as WorkerRequest,
          environment,
        )
      ).status,
    ).toBe(200);
  });
  test('restores updates, chat history and cooldown after object reconstruction', () => {
    const { context, office, first, second, outsider, database } = createOffice();
    office.webSocketMessage(first.socket, JSON.stringify({ type: 'move', x: 570, y: 140 }));
    const requestId = crypto.randomUUID();
    office.webSocketMessage(
      first.socket,
      JSON.stringify({
        type: 'chat',
        text: 'Persistent while occupied',
        channel: 'general',
        requestId,
      }),
    );
    expect(first.events.at(-1)).toEqual({ type: 'ack', requestId });
    expect(second.events.at(-1)?.type).toBe('message');
    expect(outsider.events).toHaveLength(0);
    const restored = new OfficeDurableObject(context);
    const rejectedId = crypto.randomUUID();
    restored.webSocketMessage(
      first.socket,
      JSON.stringify({ type: 'chat', text: 'Too soon', channel: 'general', requestId: rejectedId }),
    );
    expect(first.events.at(-1)).toMatchObject({ type: 'error', requestId: rejectedId });
    restored.webSocketMessage(second.socket, JSON.stringify({ type: 'status', status: 'focus' }));
    expect(second.events.at(-1)).toMatchObject({
      type: 'presence',
      players: expect.arrayContaining([expect.objectContaining({ x: 570, y: 140 })]),
    });
    const stored = database
      .query<{ messages: string }, [string]>('SELECT messages FROM history WHERE workspace = ?')
      .get('alpha');
    expect(JSON.parse(stored?.messages ?? '[]')).toHaveLength(1);
    restored.webSocketClose(first.socket);
    restored.webSocketClose(second.socket);
    expect(database.query('SELECT * FROM history').all()).toHaveLength(0);
    database.close();
  });
  test('rejects impersonation, cross-workspace signaling and oversized payloads', () => {
    const { office, first, outsider, database } = createOffice();
    const requestId = crypto.randomUUID();
    office.webSocketMessage(
      first.socket,
      JSON.stringify({
        type: 'chat',
        text: 'Spoof',
        channel: 'general',
        senderId: crypto.randomUUID(),
        requestId,
      }),
    );
    expect(first.events.at(-1)).toMatchObject({ type: 'error', requestId });
    const otherPlayer = (outsider.socket.deserializeAttachment() as { player: Player }).player;
    office.webSocketMessage(
      first.socket,
      JSON.stringify({
        type: 'signal',
        target: otherPlayer.id,
        signal: { kind: 'invite', callId: crypto.randomUUID() },
      }),
    );
    expect(first.events.at(-1)?.type).toBe('error');
    expect(outsider.events).toHaveLength(0);
    office.webSocketMessage(first.socket, 'x'.repeat(20_001));
    expect(first.closeCode()).toBe(1009);
    database.close();
  });
  test('does not broadcast or acknowledge a chat when durable storage fails', () => {
    const { office, first, second, database } = createOffice();
    database.close();
    const requestId = crypto.randomUUID();
    office.webSocketMessage(
      first.socket,
      JSON.stringify({ type: 'chat', text: 'Not stored', channel: 'general', requestId }),
    );
    expect(first.events.at(-1)).toMatchObject({ type: 'error', requestId });
    expect(first.events.some((event) => event.type === 'ack')).toBe(false);
    expect(second.events).toHaveLength(0);
  });

  test('retains rate-limit counters across hibernation', () => {
    const { context, office, first, database } = createOffice();
    for (let index = 0; index < 20; index++) office.webSocketMessage(first.socket, '{}');
    const restored = new OfficeDurableObject(context);
    for (let index = 0; index < 21; index++) restored.webSocketMessage(first.socket, '{}');
    expect(first.closeCode()).toBe(1008);
    database.close();
  });

  test('serializes a presence broadcast once while preserving workspace isolation', () => {
    const { office, first, second, outsider, database } = createOffice();
    const raw = JSON.stringify({ type: 'move', x: 570, y: 140 });
    const stringify = spyOn(JSON, 'stringify');
    try {
      office.webSocketMessage(first.socket, raw);
      expect(stringify).toHaveBeenCalledTimes(1);
      expect(first.events).toEqual(second.events);
      expect(first.events.at(-1)?.type).toBe('presence');
      expect(outsider.events).toHaveLength(0);
    } finally {
      stringify.mockRestore();
      database.close();
    }
  });

  test('rejects malformed call signals without forwarding them', () => {
    const { office, first, second, database } = createOffice();
    const target = (second.socket.deserializeAttachment() as { player: Player }).player.id;
    try {
      for (const event of [
        { type: 'signal', target: 'not-a-guest-id', signal: { kind: 'invite' } },
        { type: 'signal', target, signal: { kind: 'invite', callId: null } },
        { type: 'signal', target, signal: { kind: 'invite', unexpected: true } },
      ]) {
        office.webSocketMessage(first.socket, JSON.stringify(event));
        expect(first.events.at(-1)).toEqual({
          type: 'error',
          message: 'That action could not be completed. Please try again.',
        });
      }
      expect(second.events).toHaveLength(0);
    } finally {
      database.close();
    }
  });
});
