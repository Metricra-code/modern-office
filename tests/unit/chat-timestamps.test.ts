import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/features/chat/chat-panel';
import { DEFAULT_PLAYER } from '../../src/features/realtime/demo';
import type { ChatMessage } from '../../src/lib/protocol';

const renderChat = (sentAt: number) => {
  const message: ChatMessage = {
    id: 'message',
    senderId: DEFAULT_PLAYER.id,
    name: DEFAULT_PLAYER.name,
    color: DEFAULT_PLAYER.color,
    text: 'A session message',
    channel: 'general',
    sentAt,
  };
  return renderToStaticMarkup(
    createElement(ChatPanel, {
      messages: [message],
      players: [DEFAULT_PLAYER],
      self: DEFAULT_PLAYER,
      room: 'studio',
      isDemo: true,
      canSend: true,
      onSend: async () => true,
      onCall: () => {},
    }),
  );
};

test('messages show a 24-hour HH:MM time', () => {
  const sentAt = Date.UTC(2026, 9, 10, 9, 15);
  const expected = new Date(sentAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  expect(renderChat(sentAt)).toContain(`<time>${expected}</time>`);
});

test('sample messages are marked as samples instead of showing a time', () => {
  expect(renderChat(0)).toContain('<time>sample</time>');
});

test('out-of-range timestamps render a fallback instead of crashing chat', () => {
  expect(renderChat(1e100)).toContain('<time>Invalid Date</time>');
});
