'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Hash, MessageCircle, Phone, Users } from 'lucide-react';
import type { Channel, ChatMessage, Player } from '@/lib/protocol';
import { getRoomDetails, type RoomId } from '@/lib/space';
import { Avatar } from './avatar';

const messageTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const formatMessageTime = (sentAt: number): string => {
  const date = new Date(sentAt);
  return Number.isNaN(date.getTime()) ? 'Invalid Date' : messageTime.format(date);
};

interface ChatPanelProps {
  messages: readonly ChatMessage[];
  players: readonly Player[];
  self: Player;
  room: RoomId;
  isDemo: boolean;
  canSend: boolean;
  onSend: (text: string, channel: Channel) => Promise<boolean>;
  onCall: (player: Player) => void;
}
export const ChatPanel = ({
  messages,
  players,
  self,
  room,
  isDemo,
  canSend,
  onSend,
  onCall,
}: ChatPanelProps) => {
  const [tab, setTab] = useState<'general' | 'room' | 'people'>('general');
  const [draft, setDraft] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const channel: Channel = tab === 'room' ? room : 'general';
  const visible = messages.filter((message) => message.channel === channel);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [messages, channel]);
  return (
    <aside className="chat-panel" aria-label="Team conversations">
      <div className="chat-heading">
        <div>
          <MessageCircle size={19} />
          <h2>Conversations</h2>
        </div>
        <span className="subtle-tag">{isDemo ? 'DEMO' : 'LIVE'}</span>
      </div>
      <div className="chat-tabs" role="tablist" aria-label="Conversation channels">
        <button
          role="tab"
          id="tab-general"
          aria-controls="chat-content"
          aria-selected={tab === 'general'}
          onClick={() => setTab('general')}
        >
          # General
        </button>
        <button
          role="tab"
          id="tab-room"
          aria-controls="chat-content"
          aria-selected={tab === 'room'}
          onClick={() => setTab('room')}
        >
          This room
        </button>
        <button
          role="tab"
          id="tab-people"
          aria-controls="chat-content"
          aria-selected={tab === 'people'}
          onClick={() => setTab('people')}
          aria-label="People"
        >
          <Users size={16} />
        </button>
      </div>
      <div className="conversation-context">
        {tab === 'people' ? (
          <>
            <Users size={15} /> {players.length} {isDemo ? 'sample teammates' : 'guests here'}
          </>
        ) : (
          <>
            <Hash size={15} />
            {tab === 'general' ? 'Workspace channel' : getRoomDetails(room).name}
          </>
        )}
      </div>
      <div
        id="chat-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="chat-content"
        ref={scrollRef}
      >
        {tab === 'people' ? (
          <div className="people-list">
            {players.map((player) => (
              <div className="people-row" key={player.id}>
                <Avatar {...player} />
                <div>
                  <strong>
                    {player.name}
                    {player.id === self.id ? ' (you)' : ''}
                  </strong>
                  <span>
                    {player.status === 'focus'
                      ? 'Focusing'
                      : player.status === 'away'
                        ? 'Away'
                        : 'Available'}
                    {isDemo && player.id !== self.id ? ' · sample' : ''}
                  </span>
                </div>
                {player.id !== self.id && (
                  <button
                    className="icon-button"
                    aria-label={`Call ${player.name}`}
                    onClick={() => onCall(player)}
                  >
                    <Phone size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="chat-date">
              <span />
              {isDemo ? 'SAMPLE CONVERSATION' : 'THIS SESSION'}
              <span />
            </div>
            <div
              className="messages"
              role="log"
              aria-label={`${channel} messages`}
              aria-live="polite"
              aria-relevant="additions"
            >
              {visible.length ? (
                visible.map((message) => (
                  <article
                    className={`message ${message.senderId === self.id ? 'message-self' : ''}`}
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
                ))
              ) : (
                <div className="chat-empty">
                  <MessageCircle size={29} />
                  <h3>No messages yet</h3>
                  <p>
                    {isDemo
                      ? 'Messages stay in this browser in demo mode.'
                      : 'Send the first message. Everyone in this workspace can read this channel.'}
                  </p>
                </div>
              )}
            </div>
            {isDemo && (
              <div className="demo-note">
                <p>Sample messages. Join a live room to chat with other guests.</p>
              </div>
            )}
          </>
        )}
      </div>
      {tab !== 'people' && (
        <form
          className="chat-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending) return;
            if (!draft.trim()) {
              setFormError('Write a message first.');
              return;
            }
            const submitted = draft;
            setSending(true);
            try {
              if (await onSend(submitted, channel)) {
                setDraft((current) => (current === submitted ? '' : current));
                setFormError('');
              }
            } catch {
              setFormError('Message not sent. Please try again.');
            } finally {
              setSending(false);
            }
          }}
        >
          <label className="sr-only" htmlFor="message">
            Message {channel}
          </label>
          <div className="composer">
            <textarea
              id="message"
              value={draft}
              maxLength={500}
              placeholder={
                canSend
                  ? `Message ${tab === 'room' ? 'this room' : '#general'}…`
                  : 'Connect to send messages…'
              }
              disabled={!canSend}
              onChange={(event) => {
                setDraft(event.target.value);
                setFormError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              aria-describedby="message-help message-error"
            />
            <div className="composer-bottom">
              <span aria-live="polite">
                {sending ? 'Sending…' : draft.length ? `${draft.length}/500` : '500 characters max'}
              </span>
              <button
                className="send-button"
                aria-label="Send message"
                disabled={!canSend || !draft.trim() || sending}
                aria-busy={sending}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
          <span id="message-error" className="form-error" role="status">
            {formError}
          </span>
          <p id="message-help">
            {isDemo
              ? 'Local demo only · not sent to teammates'
              : 'Enter to send · Shift + Enter for a new line'}
          </p>
        </form>
      )}
    </aside>
  );
};
