export interface Point {
  x: number;
  y: number;
}
export type RoomId = 'studio' | 'meeting' | 'quiet' | 'lounge';
export interface Room {
  id: RoomId;
  name: string;
  description: string;
  capacity: number;
  spawn: Point;
}
export const WORLD = { width: 900, height: 570 } as const;
export const ROOMS: readonly Room[] = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Shared desks',
    capacity: 8,
    spawn: { x: 145, y: 125 },
  },
  {
    id: 'meeting',
    name: 'Meeting room',
    description: 'Team discussions',
    capacity: 4,
    spawn: { x: 570, y: 140 },
  },
  {
    id: 'quiet',
    name: 'Focus room',
    description: 'Quiet work area',
    capacity: 4,
    spawn: { x: 145, y: 400 },
  },
  {
    id: 'lounge',
    name: 'Lounge',
    description: 'Informal conversations',
    capacity: 6,
    spawn: { x: 630, y: 475 },
  },
];
interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
}
// Browser and server share the same boundaries. Furniture and plants are decorative.
// Only room walls block movement; visible doorways and the central hallway stay open.
const WALL_CLEARANCE = 4;
const ROOM_WALLS: readonly Wall[] = [
  { x: 458, y: 47, width: 18, height: 200 },
  { x: 458, y: 340, width: 17, height: 154 },
  { x: 46, y: 245, width: 128, height: 14 },
  { x: 327, y: 245, width: 173, height: 14 },
  { x: 580, y: 245, width: 274, height: 14 },
  { x: 46, y: 331, width: 128, height: 15 },
  { x: 327, y: 331, width: 393, height: 15 },
  { x: 796, y: 331, width: 58, height: 15 },
];
export const isWalkable = (point: Point): boolean => {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (point.x < 65 || point.x > 835 || point.y < 88 || point.y > 480) return false;
  return !ROOM_WALLS.some(
    (wall) =>
      point.x >= wall.x - WALL_CLEARANCE &&
      point.x <= wall.x + wall.width + WALL_CLEARANCE &&
      point.y >= wall.y - WALL_CLEARANCE &&
      point.y <= wall.y + wall.height + WALL_CLEARANCE,
  );
};
export const movePlayer = (position: Point, delta: Point): Point => {
  const destination = { x: position.x + delta.x, y: position.y + delta.y };
  return isWalkable(destination) ? destination : position;
};
export const getRoom = (point: Point): RoomId => {
  if (point.y < 340) return point.x < 470 ? 'studio' : 'meeting';
  return point.x < 470 ? 'quiet' : 'lounge';
};
export const getRoomDetails = (id: RoomId): Room =>
  ROOMS.find((room) => room.id === id) ?? ROOMS[0];
