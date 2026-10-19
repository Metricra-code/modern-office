import { Coffee, DoorOpen, Headphones, LayoutGrid, type LucideIcon } from 'lucide-react';
import type { RoomId } from '@/lib/protocol';

export const ROOM_ICONS: Record<RoomId, LucideIcon> = {
  studio: LayoutGrid,
  meeting: DoorOpen,
  quiet: Headphones,
  lounge: Coffee,
};
