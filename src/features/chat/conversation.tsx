'use client';
import { useMemo } from 'react';
import { Hash, MessageCircle } from 'lucide-react';
import type { Channel, ChatMessage } from '@/lib/protocol';
import { Composer, type ComposerDrafts, type DraftKey } from './composer';
import { MessageList } from './message-list';
import { useFollowLatest } from './use-follow-latest';

interface ConversationProps {
  tabId: string;
  channel: Channel;
  /** Where the conversation happens, shown above the log. */
  context: string;
  /** How the composer names the channel, as in "Message #general…". */
  channelLabel: string;
  messages: readonly ChatMessage[];
  selfId: string;
  isDemo: boolean;
  canSend: boolean;
  active: boolean;
  drafts: ComposerDrafts;
  onSend: (text: string, channel: Channel) => Promise<boolean>;
}
export const Conversation = ({
  tabId,
  channel,
  context,
  channelLabel,
  messages,
  selfId,
  isDemo,
  canSend,
  active,
  drafts,
  onSend,
}: ConversationProps) => {
  const draftKey: DraftKey = `${isDemo ? 'demo' : 'live'}:${channel}`;
  const visible = useMemo(
    () => messages.filter((message) => message.channel === channel),
    [messages, channel],
  );
  const { scrollRef, hasNewMessages, onScroll, jumpToLatest } = useFollowLatest(
    draftKey,
    visible.at(-1)?.id,
    active,
  );
  return (
    <>
      <div className="conversation-context">
        <Hash size={15} />
        {context}
      </div>
      <div
        id="chat-content"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={tabId}
        className="chat-content"
        ref={scrollRef}
        onScroll={onScroll}
      >
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
            <MessageList messages={visible} selfId={selfId} />
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
      </div>
      {hasNewMessages && (
        <button
          type="button"
          className="chat-jump-latest"
          aria-controls="chat-content"
          onClick={jumpToLatest}
        >
          New messages · Jump to latest
        </button>
      )}
      <Composer
        drafts={drafts}
        draftKey={draftKey}
        channel={channel}
        channelLabel={channelLabel}
        isDemo={isDemo}
        canSend={canSend}
        onSend={onSend}
      />
    </>
  );
};
