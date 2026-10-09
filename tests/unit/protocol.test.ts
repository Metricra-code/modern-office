import { describe, expect, test } from 'bun:test';
import { clientEventSchema, serverEventSchema, workspaceSchema } from '../../src/lib/protocol';

describe('untrusted messages', () => {
  test('trims messages and rejects empty or oversized text', () => {
    expect(
      clientEventSchema.parse({ type: 'chat', text: ' hello ', channel: 'general' }),
    ).toMatchObject({ text: 'hello' });
    expect(
      clientEventSchema.safeParse({ type: 'chat', text: ' ', channel: 'general' }).success,
    ).toBe(false);
    expect(
      clientEventSchema.safeParse({ type: 'chat', text: 'a'.repeat(501), channel: 'general' })
        .success,
    ).toBe(false);
  });
  test('rejects impersonation fields and out-of-bounds movement', () => {
    expect(clientEventSchema.safeParse({ type: 'move', x: Infinity, y: 100 }).success).toBe(false);
    expect(
      clientEventSchema.safeParse({ type: 'chat', text: 'hi', channel: 'general', name: 'Admin' })
        .success,
    ).toBe(false);
  });
  test('limits workspace identifiers', () => {
    expect(workspaceSchema.safeParse('../admin').success).toBe(false);
    expect(workspaceSchema.parse('studio-team')).toBe('studio-team');
  });
  test('validates server messages before updating UI', () => {
    expect(serverEventSchema.safeParse({ type: 'snapshot', players: 'not-an-array' }).success).toBe(
      false,
    );
  });
});
