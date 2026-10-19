import type { PresenceStatus } from './protocol';

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: 'Available',
  focus: 'Focusing',
  away: 'Away',
};
