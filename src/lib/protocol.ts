import { z } from 'zod';

export const roomIdSchema = z.enum(['studio', 'meeting', 'quiet', 'lounge']);
export const channelSchema = z.enum(['general', 'studio', 'meeting', 'quiet', 'lounge']);
export const workspaceSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(24),
    color: z.enum(['terracotta', 'sage', 'blue', 'gold', 'plum']),
  })
  .strict();
const pointSchema = z.object({
  x: z.number().finite().min(65).max(835),
  y: z.number().finite().min(88).max(480),
});
export const playerSchema = profileSchema.extend({
  id: z.string().uuid(),
  x: pointSchema.shape.x,
  y: pointSchema.shape.y,
  status: z.enum(['available', 'focus', 'away']),
});
const signalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invite') }).strict(),
  z.object({ kind: z.literal('accept') }).strict(),
  z.object({ kind: z.literal('decline') }).strict(),
  z.object({ kind: z.literal('end') }).strict(),
  z.object({ kind: z.literal('offer'), sdp: z.string().max(16000) }).strict(),
  z.object({ kind: z.literal('answer'), sdp: z.string().max(16000) }).strict(),
  z
    .object({
      kind: z.literal('ice'),
      candidate: z.string().max(2000),
      sdpMid: z.string().max(100).nullable(),
      sdpMLineIndex: z.number().int().min(0).max(100).nullable(),
    })
    .strict(),
]);
export const clientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), ...pointSchema.shape }).strict(),
  z.object({ type: z.literal('profile'), ...profileSchema.shape }).strict(),
  z.object({ type: z.literal('status'), status: playerSchema.shape.status }).strict(),
  z
    .object({
      type: z.literal('chat'),
      text: z.string().trim().min(1).max(500),
      channel: channelSchema,
      requestId: z.string().uuid().optional(),
    })
    .strict(),
  z.object({ type: z.literal('signal'), target: z.string().uuid(), signal: signalSchema }).strict(),
]);
export const messageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string(),
  name: z.string().max(24),
  color: profileSchema.shape.color,
  text: z.string().max(500),
  channel: channelSchema,
  sentAt: z.number().finite(),
});
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    selfId: z.string().uuid(),
    players: z.array(playerSchema).max(32),
    messages: z.array(messageSchema).max(100),
  }),
  z.object({ type: z.literal('presence'), players: z.array(playerSchema).max(32) }),
  z.object({ type: z.literal('message'), message: messageSchema }),
  z.object({ type: z.literal('signal'), from: z.string().uuid(), signal: signalSchema }),
  z.object({ type: z.literal('ack'), requestId: z.string().uuid() }),
  z.object({
    type: z.literal('error'),
    message: z.string().max(200),
    requestId: z.string().uuid().optional(),
  }),
]);
export type Player = z.infer<typeof playerSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;
export type ClientEvent = z.infer<typeof clientEventSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type PresenceStatus = Player['status'];
