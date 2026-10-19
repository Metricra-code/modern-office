'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Hash, MessageCircle, Phone, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_LABEL } from '@/lib/presence';
import type { Channel, ChatMessage, Player, RoomId } from '@/lib/protocol';
import { getRoomDetails } from '@/lib/space';

const messageTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const formatMessageTime = (sentAt: number): string => {
  const date = new Date(sentAt);
  return Number.isNaN(date.getTime()) ? 'Invalid Date' : messageTime.format(date);
};
const TABS = ['general', 'room', 'people'] as const;
type ChatTab = (typeof TABS)[number];
type DraftKey = `${'demo' | 'live'}:${Channel}`;
interface ComposerDraft {
  text: string;
  revision: number;
  error: string;
}
const EMPTY_DRAFT: ComposerDraft = { text: '', revision: 0, error: '' };
const MessageList = memo(function MessageList({
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

interface ChatPanelProps {
  messages: readonly ChatMessage[];
  players: readonly Player[];
  self: Player;
  room: RoomId;
  isDemo: boolean;
  canSend: boolean;
  onSend: (text: string, channel: Channel) => Promise<boolean>;
  onCall: (player: Player) => void;
  active?: boolean;
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
  active = true,
}: ChatPanelProps) => {
  const [tab, setTab] = useState<ChatTab>('general');
  const [drafts, setDrafts] = useState<Partial<Record<DraftKey, ComposerDraft>>>({});
  const [sending, setSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const channel: Channel = tab === 'room' ? room : 'general';
  const draftKey: DraftKey = `${isDemo ? 'demo' : 'live'}:${channel}`;
  const composer = drafts[draftKey] ?? EMPTY_DRAFT;
  const draft = composer.text;
  const panelKey = tab === 'people' ? 'people' : draftKey;
  const visible = useMemo(
    () => messages.filter((message) => message.channel === channel),
    [messages, channel],
  );
  const latestMessageId = tab === 'people' ? undefined : visible.at(-1)?.id;
  const scrollRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<{ panel?: string; latest?: string; follow: boolean }>({ follow: true });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const panel = scrollRef.current;
      if (!panel?.clientHeight) return;
      const reading = readingRef.current;
      const switchedPanel = reading.panel !== panelKey;
      if (switchedPanel || reading.follow) {
        panel.scrollTop = tab === 'people' ? 0 : panel.scrollHeight;
        setHasNewMessages(false);
      } else if (latestMessageId && latestMessageId !== reading.latest) {
        setHasNewMessages(true);
      }
      readingRef.current = {
        panel: panelKey,
        latest: latestMessageId,
        follow: switchedPanel || reading.follow,
      };
    });
    return () => cancelAnimationFrame(frame);
  }, [active, latestMessageId, panelKey, tab]);
  const jumpToLatest = () => {
    const panel = scrollRef.current;
    if (!panel) return;
    readingRef.current = { ...readingRef.current, follow: true };
    panel.scrollTop = panel.scrollHeight;
    setHasNewMessages(false);
    panel.focus();
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.indexOf(tab);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index + TABS.length - 1) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = TABS[nextIndex];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  const setDraftError = (error: string) =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...(current[draftKey] ?? EMPTY_DRAFT), error },
    }));
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
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            id={`tab-${item}`}
            aria-controls="chat-content"
            aria-selected={tab === item}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => setTab(item)}
            onFocus={() => setTab(item)}
            onKeyDown={handleTabKeyDown}
            aria-label={item === 'people' ? 'People' : undefined}
          >
            {item === 'general' ? '# General' : item === 'room' ? 'This room' : <Users size={16} />}
          </button>
        ))}
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
        tabIndex={0}
        aria-labelledby={`tab-${tab}`}
        className="chat-content"
        ref={scrollRef}
        onScroll={(event) => {
          const panel = event.currentTarget;
          if (!panel.clientHeight || tab === 'people') return;
          // Appending or switching panels can scroll via layout before the follow frame runs.
          if (
            readingRef.current.panel !== panelKey ||
            readingRef.current.latest !== latestMessageId
          )
            return;
          const follow = panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 48;
          readingRef.current = { ...readingRef.current, follow };
          if (follow) setHasNewMessages(false);
        }}
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
                    {STATUS_LABEL[player.status]}
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
                <MessageList messages={visible} selfId={self.id} />
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
      {tab !== 'people' && hasNewMessages && (
        <button
          type="button"
          className="chat-jump-latest"
          aria-controls="chat-content"
          onClick={jumpToLatest}
        >
          New messages · Jump to latest
        </button>
      )}
      {tab !== 'people' && (
        <form
          className="chat-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending) return;
            if (!draft.trim()) {
              setDraftError('Write a message first.');
              return;
            }
            const submitted = composer;
            setSending(true);
            try {
              if (await onSend(submitted.text, channel)) {
                setDrafts((current) =>
                  current[draftKey]?.revision === submitted.revision
                    ? {
                        ...current,
                        [draftKey]: { text: '', revision: submitted.revision + 1, error: '' },
                      }
                    : current,
                );
              }
            } catch {
              setDraftError('Message not sent. Please try again.');
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
                const text = event.target.value;
                setDrafts((current) => ({
                  ...current,
                  [draftKey]: {
                    text,
                    revision: (current[draftKey]?.revision ?? 0) + 1,
                    error: '',
                  },
                }));
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
            {composer.error}
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
