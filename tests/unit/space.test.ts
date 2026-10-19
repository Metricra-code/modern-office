import { describe, expect, test } from 'bun:test';
import { getRoom, movePlayer, isWalkable, ROOMS } from '../../src/lib/space';

describe('spatial movement', () => {
  test('keeps movement within the office', () => {
    expect(movePlayer({ x: 30, y: 50 }, { x: -100, y: 0 })).toEqual({ x: 30, y: 50 });
  });
  test('furniture and plants are decorative, not movement barriers', () => {
    for (const point of [
      { x: 216, y: 140 },
      { x: 665, y: 160 },
      { x: 210, y: 420 },
      { x: 700, y: 420 },
      { x: 500, y: 370 },
    ])
      expect(isWalkable(point)).toBe(true);
    expect(movePlayer({ x: 160, y: 130 }, { x: 8, y: 0 })).toEqual({ x: 168, y: 130 });
  });
  test('keeps walls, outer boundaries and invalid coordinates blocked', () => {
    for (const point of [
      { x: 468, y: 150 },
      { x: 650, y: 338 },
      { x: 40, y: 130 },
      { x: 700, y: 520 },
      { x: NaN, y: 140 },
      { x: 200, y: Infinity },
    ])
      expect(isWalkable(point)).toBe(false);
  });
  test('allows walking in the central corridor', () => {
    expect(movePlayer({ x: 450, y: 315 }, { x: 8, y: 0 })).toEqual({ x: 458, y: 315 });
  });
  test('identifies focus and social spaces', () => {
    expect(getRoom({ x: 145, y: 125 })).toBe('studio');
    expect(getRoom({ x: 650, y: 465 })).toBe('lounge');
  });
  test('every room has a walkable arrival point', () => {
    for (const room of ROOMS) {
      expect(isWalkable(room.spawn)).toBe(true);
      expect(getRoom(room.spawn)).toBe(room.id);
    }
  });
});

test('all sample teammates and the local avatar start on open floor', async () => {
  const { DEMO_PLAYERS, DEFAULT_PLAYER } = await import('../../src/features/realtime/demo');
  for (const player of [...DEMO_PLAYERS, DEFAULT_PLAYER]) expect(isWalkable(player)).toBe(true);
});

test('the illustrated hallway is clear across its full width', () => {
  for (const x of [100, 400, 650, 800]) {
    for (const y of [270, 300, 320]) expect(isWalkable({ x, y })).toBe(true);
  }
});

test('keyboard steps can reach every room through visible doorways', () => {
  // Routes use the same eight-unit cardinal steps as keyboard movement.
  const routes = [
    [
      { x: -8, y: 0, steps: 23 },
      { x: 0, y: -8, steps: 24 },
    ],
    [
      { x: 8, y: 0, steps: 15 },
      { x: 0, y: -8, steps: 22 },
    ],
    [
      { x: -8, y: 0, steps: 23 },
      { x: 0, y: 8, steps: 11 },
    ],
    [
      { x: 8, y: 0, steps: 41 },
      { x: 0, y: 8, steps: 5 },
      { x: -8, y: 0, steps: 24 },
      { x: 0, y: 8, steps: 15 },
    ],
  ];
  for (const [index, route] of routes.entries()) {
    let position = { x: 450, y: 315 };
    for (const segment of route) {
      for (let step = 0; step < segment.steps; step++) {
        const destination = { x: position.x + segment.x, y: position.y + segment.y };
        expect(isWalkable(destination)).toBe(true);
        position = movePlayer(position, segment);
      }
    }
    expect(getRoom(position)).toBe(ROOMS[index].id);
  }
});
