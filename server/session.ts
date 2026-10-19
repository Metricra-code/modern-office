import { z } from 'zod';
import { LIMITS } from '../src/lib/limits';
import {
  clientEventSchema,
  profileSchema,
  workspaceSchema,
  type ChatEvent,
  type ClientEvent,
  type Profile,
  type ServerEvent,
} from '../src/lib/protocol';
import type { OfficeRooms } from './rooms';

export interface Guest {
  id: string;
  workspaceId: string;
  windowStart: number;
  events: number;
  lastChat: number;
}
export type Delivery =
  | { to: 'self'; event: ServerEvent }
  | { to: 'workspace'; event: ServerEvent }
  | { to: 'guest'; id: string; event: ServerEvent };
export interface Outcome {
  guest: Guest;
  deliveries: Delivery[];
  close?: { code: number; reason: string };
}
export type PersistHistory = (workspaceId: string) => void;

const ACTION_FAILED = 'That action could not be completed. Please try again.';
const CHAT_COOLDOWN = 'Give your message a moment before sending another.';
const requestEnvelope = z.object({ requestId: z.string().uuid() });
const encoder = new TextEncoder();

export const parseHandshake = (url: URL): { workspaceId: string; profile: Profile } | undefined => {
  const workspace = workspaceSchema.safeParse(url.searchParams.get('workspace'));
  const profile = profileSchema.safeParse({
    name: url.searchParams.get('name'),
    color: url.searchParams.get('color'),
  });
  return workspace.success && profile.success
    ? { workspaceId: workspace.data, profile: profile.data }
    : undefined;
};

export const createGuest = (id: string, workspaceId: string, now: number): Guest => ({
  id,
  workspaceId,
  windowStart: now,
  events: 0,
  lastChat: 0,
});

export const presence = (rooms: OfficeRooms, workspaceId: string): ServerEvent => ({
  type: 'presence',
  players: rooms.snapshot(workspaceId).players,
});

export const welcome = (rooms: OfficeRooms, guest: Guest): ServerEvent => ({
  type: 'welcome',
  selfId: guest.id,
  ...rooms.snapshot(guest.workspaceId),
});

const fail = (guest: Guest, message: string, requestId?: string): Outcome => ({
  guest,
  deliveries: [
    { to: 'self', event: { type: 'error', message, ...(requestId ? { requestId } : {}) } },
  ],
});

const chat = (
  rooms: OfficeRooms,
  guest: Guest,
  event: ChatEvent,
  now: number,
  persist?: PersistHistory,
): Outcome => {
  if (now - guest.lastChat < LIMITS.chatCooldownMs)
    return fail(guest, CHAT_COOLDOWN, event.requestId);
  const previous = rooms.snapshot(guest.workspaceId);
  const message = rooms.chat(guest.id, event);
  try {
    persist?.(guest.workspaceId);
  } catch (error) {
    rooms.restore(guest.workspaceId, previous);
    throw error;
  }
  const deliveries: Delivery[] = [{ to: 'workspace', event: { type: 'message', message } }];
  if (event.requestId)
    deliveries.push({ to: 'self', event: { type: 'ack', requestId: event.requestId } });
  return { guest: { ...guest, lastChat: now }, deliveries };
};

const apply = (
  rooms: OfficeRooms,
  guest: Guest,
  event: ClientEvent,
  now: number,
  persist?: PersistHistory,
): Outcome => {
  switch (event.type) {
    case 'chat':
      return chat(rooms, guest, event, now, persist);
    case 'signal':
      if (!rooms.canSignal(guest.id, event.target)) throw new Error('Invalid call target');
      return {
        guest,
        deliveries: [
          {
            to: 'guest',
            id: event.target,
            event: { type: 'signal', from: guest.id, signal: event.signal },
          },
        ],
      };
    case 'move':
      rooms.move(guest.id, event);
      break;
    case 'profile':
      rooms.profile(guest.id, event);
      break;
    case 'status':
      rooms.status(guest.id, event.status);
      break;
  }
  return { guest, deliveries: [{ to: 'workspace', event: presence(rooms, guest.workspaceId) }] };
};

export const handleMessage = (
  rooms: OfficeRooms,
  current: Guest,
  raw: unknown,
  now: number,
  persist?: PersistHistory,
): Outcome => {
  if (typeof raw !== 'string' || encoder.encode(raw).byteLength > LIMITS.payloadBytes)
    return { guest: current, deliveries: [], close: { code: 1009, reason: 'Message too large' } };
  const guest =
    now - current.windowStart >= 1000
      ? { ...current, windowStart: now, events: 1 }
      : { ...current, events: current.events + 1 };
  if (guest.events > LIMITS.eventsPerSecond)
    return { guest, deliveries: [], close: { code: 1008, reason: 'Too many messages' } };
  let incoming: unknown;
  try {
    incoming = JSON.parse(raw);
  } catch {
    return fail(guest, ACTION_FAILED);
  }
  const requestId = requestEnvelope.safeParse(incoming).data?.requestId;
  const event = clientEventSchema.safeParse(incoming);
  if (!event.success) return fail(guest, ACTION_FAILED, requestId);
  try {
    return apply(rooms, guest, event.data, now, persist);
  } catch {
    return fail(guest, ACTION_FAILED, requestId);
  }
};
