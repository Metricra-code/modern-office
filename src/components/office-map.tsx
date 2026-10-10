'use client';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, LocateFixed, Navigation } from 'lucide-react';
import type { Player } from '@/lib/protocol';
import { getRoom, isWalkable, movePlayer, WORLD, type Point } from '@/lib/space';
import { Avatar } from './avatar';

const OfficeIllustration = () => (
  <div className="office-art">
    {/* Static export uses a pre-optimized local WebP; no image service required. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/office-map.webp`}
      width={1575}
      height={998}
      alt="Original overhead pixel-art office: a four-desk studio, blue meeting area, two quiet desks and a sage lounge, linked by a wide tiled hallway."
      className="floorplan"
      fetchPriority="high"
      draggable={false}
    />
    <span className="floor-room-label floor-label-studio">STUDIO</span>
    <span className="floor-room-label floor-label-meeting">MEETING ROOM</span>
    <span className="floor-room-label floor-label-quiet">FOCUS ROOM</span>
    <span className="floor-room-label floor-label-lounge">LOUNGE</span>
  </div>
);
interface OfficeMapProps {
  self: Player;
  peers: readonly Player[];
  onMove: (point: Point) => void;
  onSelect: (player: Player) => void;
}
export const OfficeMap = ({ self, peers, onMove, onSelect }: OfficeMapProps) => {
  const [zoom, setZoom] = useState(1);
  const [destination, setDestination] = useState<Point>();
  const [hint, setHint] = useState('');
  const worldRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<Point>(self);
  useEffect(() => {
    positionRef.current = self;
  }, [self]);
  useEffect(() => {
    const keys = new Set<string>();
    const directions: Record<string, Point> = {
      arrowup: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const down = (event: KeyboardEvent) => {
      if (
        !(event.target instanceof Element) ||
        !worldRef.current?.parentElement?.contains(event.target) ||
        event.target.closest('button')
      )
        return;
      const key = event.key.toLowerCase();
      if (!directions[key] || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      keys.add(key);
    };
    const up = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };
    const reset = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    const timer = window.setInterval(() => {
      if (!keys.size) return;
      if (
        !worldRef.current?.parentElement?.contains(document.activeElement) ||
        document.activeElement?.closest('button')
      ) {
        keys.clear();
        return;
      }
      const delta = [...keys].reduce(
        (sum, key) => ({ x: sum.x + directions[key].x, y: sum.y + directions[key].y }),
        { x: 0, y: 0 },
      );
      const length = Math.hypot(delta.x, delta.y);
      if (!length) return;
      const next = movePlayer(positionRef.current, {
        x: (delta.x / length) * 8,
        y: (delta.y / length) * 8,
      });
      if (next !== positionRef.current) onMove(next);
    }, 50);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, [onMove]);
  const walkTo = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    const bounds = worldRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * WORLD.width,
      y: ((event.clientY - bounds.top) / bounds.height) * WORLD.height,
    };
    if (!isWalkable(point)) {
      setHint('Choose a spot inside the office, away from walls.');
      return;
    }
    onMove(point);
    setDestination(point);
    setHint('');
    worldRef.current?.parentElement?.focus();
  };
  return (
    <div className="map-shell">
      <div
        className="map-viewport"
        tabIndex={0}
        role="group"
        aria-label="Interactive office. Use arrow keys or W A S D to move. Click a spot inside the office to relocate."
        aria-describedby="map-instructions"
        onBlur={() => setHint('')}
      >
        <div
          className="map-world"
          ref={worldRef}
          onClick={walkTo}
          style={{ width: `${Math.round(zoom * 100)}%` }}
        >
          <OfficeIllustration />
          {destination && (
            <span
              className="destination"
              aria-hidden="true"
              style={{
                left: `${(destination.x / WORLD.width) * 100}%`,
                top: `${(destination.y / WORLD.height) * 100}%`,
              }}
            />
          )}
          {[...peers, self].map((player) => (
            <button
              key={player.id}
              className={`map-person ${player.id === self.id ? 'is-self' : ''}`}
              style={{
                left: `${(player.x / WORLD.width) * 100}%`,
                top: `${(player.y / WORLD.height) * 100}%`,
              }}
              onClick={() => onSelect(player)}
              aria-label={`${player.name}${player.id === self.id ? ', you' : ''} in ${getRoom(player)}`}
            >
              <span className={`person-body body-${player.color}`} aria-hidden="true">
                <span className="person-hair" />
                <span className="person-face" />
                <span className="person-shirt" />
                <span className="person-legs" />
              </span>
              <span className="person-name">
                <span className="person-first-name">{player.name.split(' ')[0]}</span>
                {player.id === self.id && <span> you</span>}
                {player.status === 'focus' && <span aria-label="focusing"> ◌</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-bottom">
        <p id="map-instructions">
          <Navigation size={14} /> Click to move <span>or</span> <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </p>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.85, value - 0.1))}
            disabled={zoom <= 0.85}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
            disabled={zoom >= 1.35}
          >
            <Plus size={15} />
          </button>
          <span className="control-divider" />
          <button aria-label="Reset map zoom" onClick={() => setZoom(1)}>
            <LocateFixed size={17} />
          </button>
        </div>
      </div>
      {hint && (
        <p className="map-feedback" role="status">
          {hint}
        </p>
      )}
      <div className="map-you">
        <Avatar name={self.name} color={self.color} size="small" />
        <span>
          You’re in{' '}
          <strong>
            {getRoom(self) === 'studio'
              ? 'the studio'
              : getRoom(self) === 'quiet'
                ? 'the focus room'
                : getRoom(self) === 'meeting'
                  ? 'the meeting room'
                  : 'the lounge'}
          </strong>
        </span>
      </div>
    </div>
  );
};
