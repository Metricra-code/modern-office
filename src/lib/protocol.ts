import { z } from 'zod';
import { LIMITS } from './limits';
import { WALKABLE_BOUNDS } from './space';

export const roomIdSchema = z.enum(['studio', 'meeting', 'quiet', 'lounge']);
export const channelSchema = z.enum(['general', ...roomIdSchema.options]);
export const workspaceSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);
export const avatarColorSchema = z.enum(['terracotta', 'sage', 'blue', 'gold', 'plum']);
export const statusSchema = z.enum(['available', 'focus', 'away']);
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.nameLength),
    color: avatarColorSchema,
  })
  .strict();
const pointShape = {
  x: z.number().finite().min(WALKABLE_BOUNDS.minX).max(WALKABLE_BOUNDS.maxX),
  y: z.number().finite().min(WALKABLE_BOUNDS.minY).max(WALKABLE_BOUNDS.maxY),
};
export const playerSchema = profileSchema.extend({
  id: z.string().uuid(),
  ...pointShape,
  status: statusSchema,
});
const callId = z.string().uuid();
const signalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invite'), callId }).strict(),
  z.object({ kind: z.literal('accept'), callId }).strict(),
  z.object({ kind: z.literal('decline'), callId }).strict(),
  z.object({ kind: z.literal('end'), callId }).strict(),
  z.object({ kind: z.literal('offer'), callId, sdp: z.string().max(16000) }).strict(),
  z.object({ kind: z.literal('answer'), callId, sdp: z.string().max(16000) }).strict(),
  z
    .object({
      kind: z.literal('ice'),
      callId,
      candidate: z.string().max(2000),
      sdpMid: z.string().max(100).nullable(),
      sdpMLineIndex: z.number().int().min(0).max(100).nullable(),
    })
    .strict(),
]);
export const clientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), ...pointShape }).strict(),
  z.object({ type: z.literal('profile'), ...profileSchema.shape }).strict(),
  z.object({ type: z.literal('status'), status: statusSchema }).strict(),
  z
    .object({
      type: z.literal('chat'),
      text: z.string().trim().min(1).max(LIMITS.messageLength),
      channel: channelSchema,
      requestId: z.string().uuid().optional(),
    })
    .strict(),
  z.object({ type: z.literal('signal'), target: z.string().uuid(), signal: signalSchema }).strict(),
]);
export const messageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string(),
  name: z.string().max(LIMITS.nameLength),
  color: avatarColorSchema,
  text: z.string().max(LIMITS.messageLength),
  channel: channelSchema,
  sentAt: z.number().finite(),
});
const presenceSchema = z.array(playerSchema).max(LIMITS.guestsPerWorkspace);
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    selfId: z.string().uuid(),
    players: presenceSchema,
    messages: z.array(messageSchema).max(LIMITS.history),
  }),
  z.object({ type: z.literal('presence'), players: presenceSchema }),
  z.object({ type: z.literal('message'), message: messageSchema }),
  z.object({ type: z.literal('signal'), from: z.string().uuid(), signal: signalSchema }),
  z.object({ type: z.literal('ack'), requestId: z.string().uuid() }),
  z.object({
    type: z.literal('error'),
    message: z.string().max(200),
    requestId: z.string().uuid().optional(),
  }),
]);
export type RoomId = z.infer<typeof roomIdSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type PresenceStatus = z.infer<typeof statusSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Player = z.infer<typeof playerSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type ClientEvent = z.infer<typeof clientEventSchema>;
export type ChatEvent = Extract<ClientEvent, { type: 'chat' }>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export const AVATAR_COLORS = avatarColorSchema.options;
export interface IncomingSignal {
  from: string;
  signal: Signal;
}
