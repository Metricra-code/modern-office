import { expect, test } from 'bun:test';
import { OfficeRooms } from '../../server/rooms';
import { clientEventSchema, serverEventSchema } from '../../src/lib/protocol';

test('domain projections never leak transport discriminants into player records', () => {
  const rooms = new OfficeRooms();
  const player = rooms.join('typed-room', { name: 'Guest', color: 'sage' });
  const move = clientEventSchema.parse({ type: 'move', x: 550, y: 315 });
  if (move.type === 'move') rooms.move(player.id, move);
  const profile = clientEventSchema.parse({ type: 'profile', name: 'Alice', color: 'blue' });
  if (profile.type === 'profile') rooms.profile(player.id, profile);
  expect(
    serverEventSchema.safeParse({
      type: 'welcome',
      selfId: player.id,
      ...rooms.snapshot('typed-room'),
    }).success,
  ).toBe(true);
});
