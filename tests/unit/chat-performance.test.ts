import { expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/components/chat-panel';
import { DEFAULT_PLAYER } from '../../src/lib/demo';
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

test('chat timestamps preserve formatting without constructing a formatter per message', () => {
  const sentAt = Date.UTC(2026, 9, 10, 9, 15);
  const expected = new Date(sentAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const localTime = spyOn(Date.prototype, 'toLocaleTimeString');
  try {
    expect(renderChat(sentAt)).toContain(`<time>${expected}</time>`);
    expect(renderChat(sentAt)).toContain(`<time>${expected}</time>`);
    expect(localTime).not.toHaveBeenCalled();
  } finally {
    localTime.mockRestore();
  }
});

test('chat sample timestamps retain their explicit sample marker', () => {
  expect(renderChat(0)).toContain('<time>sample</time>');
});

test('out-of-range timestamps preserve the old invalid-date fallback instead of crashing chat', () => {
  expect(renderChat(1e100)).toContain('<time>Invalid Date</time>');
});
