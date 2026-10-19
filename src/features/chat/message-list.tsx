'use client';
import { memo } from 'react';
import { Avatar } from '@/components/ui/avatar';
import type { ChatMessage } from '@/lib/protocol';

const messageTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const formatMessageTime = (sentAt: number): string => {
  const date = new Date(sentAt);
  return Number.isNaN(date.getTime()) ? 'Invalid Date' : messageTime.format(date);
};
export const MessageList = memo(function MessageList({
  messages,
  selfId,
}: {
  messages: readonly ChatMessage[];
  selfId: string;
}) {
  return messages.map((message) => (
    <article
      className={`message ${message.senderId === selfId ? 'message-self' : ''}`}
      key={message.id}
    >
      <Avatar name={message.name} color={message.color} size="small" />
      <div>
        <div className="message-meta">
          <strong>{message.name}</strong>
          <time>{message.sentAt ? formatMessageTime(message.sentAt) : 'sample'}</time>
        </div>
        <p>{message.text}</p>
      </div>
    </article>
  ));
});
