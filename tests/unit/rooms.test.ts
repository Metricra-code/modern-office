import { describe, expect, test } from 'bun:test';
import { OfficeRooms } from '../../server/rooms';
import { clientEventSchema, serverEventSchema } from '../../src/lib/protocol';

const profile = { name: 'Kai', color: 'terracotta' as const };
describe('authoritative guest workspaces', () => {
  test('assigns unique server identities and isolates workspaces', () => {
    const rooms = new OfficeRooms();
    const first = rooms.join('alpha', profile);
    const second = rooms.join('beta', profile);
    expect(first.id).not.toBe(second.id);
    expect(rooms.snapshot('alpha').players).toHaveLength(1);
    expect(rooms.canSignal(first.id, second.id)).toBe(false);
  });
  test('rejects wall collisions without overwriting position', () => {
    const rooms = new OfficeRooms();
    const player = rooms.join('alpha', profile);
    expect(() => rooms.move(player.id, { x: 468, y: 150 })).toThrow();
    expect(rooms.snapshot('alpha').players[0].x).toBe(player.x);
  });
  test('accepts movement through furniture in live workspaces', () => {
    const rooms = new OfficeRooms();
    const player = rooms.join('alpha', profile);
    rooms.move(player.id, { x: 216, y: 140 });
    expect(rooms.snapshot('alpha').players[0]).toMatchObject({ x: 216, y: 140 });
  });
  test('attributes messages to the server identity and bounds history', () => {
    const rooms = new OfficeRooms();
    const player = rooms.join('alpha', profile);
    for (let index = 0; index < 110; index++)
      rooms.chat(player.id, { text: 'hello', channel: 'general' });
    expect(rooms.snapshot('alpha').messages).toHaveLength(100);
    expect(rooms.snapshot('alpha').messages[0].senderId).toBe(player.id);
  });
  test('cleans up presence and history when the last guest leaves', () => {
    const rooms = new OfficeRooms();
    const player = rooms.join('alpha', profile);
    rooms.chat(player.id, { text: 'temporary', channel: 'general' });
    rooms.leave(player.id);
    expect(rooms.snapshot('alpha')).toEqual({ players: [], messages: [] });
  });
  test('bounds room capacity', () => {
    const rooms = new OfficeRooms();
    for (let index = 0; index < 32; index++) rooms.join('alpha', profile);
    expect(() => rooms.join('alpha', profile)).toThrow('Workspace is full');
  });

  test('snapshots after moves and profile edits parse as a strict welcome event', () => {
    const rooms = new OfficeRooms();
    const player = rooms.join('typed-room', { name: 'Guest', color: 'sage' });
    const move = clientEventSchema.parse({ type: 'move', x: 550, y: 315 });
    if (move.type === 'move') rooms.move(player.id, move);
    const edit = clientEventSchema.parse({ type: 'profile', name: 'Alice', color: 'blue' });
    if (edit.type === 'profile') rooms.profile(player.id, edit);
    const welcome = { type: 'welcome', selfId: player.id, ...rooms.snapshot('typed-room') };
    expect(serverEventSchema.safeParse(welcome).success).toBe(true);
  });
});
