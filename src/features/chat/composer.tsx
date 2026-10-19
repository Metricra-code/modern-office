'use client';
import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { Channel } from '@/lib/protocol';

export type DraftKey = `${'demo' | 'live'}:${Channel}`;
interface ComposerDraft {
  text: string;
  revision: number;
  error: string;
}
const EMPTY_DRAFT: ComposerDraft = { text: '', revision: 0, error: '' };

/** Drafts per mode and channel, owned above the conversation so they survive tab switches. */
export const useComposerDrafts = () => {
  const [drafts, setDrafts] = useState<Partial<Record<DraftKey, ComposerDraft>>>({});
  const [sending, setSending] = useState(false);
  return { drafts, setDrafts, sending, setSending };
};
export type ComposerDrafts = ReturnType<typeof useComposerDrafts>;

interface ComposerProps {
  drafts: ComposerDrafts;
  draftKey: DraftKey;
  channel: Channel;
  channelLabel: string;
  isDemo: boolean;
  canSend: boolean;
  onSend: (text: string, channel: Channel) => Promise<boolean>;
}
export const Composer = ({
  drafts: { drafts, setDrafts, sending, setSending },
  draftKey,
  channel,
  channelLabel,
  isDemo,
  canSend,
  onSend,
}: ComposerProps) => {
  const composer = drafts[draftKey] ?? EMPTY_DRAFT;
  const draft = composer.text;
  const setDraftError = (error: string) =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...(current[draftKey] ?? EMPTY_DRAFT), error },
    }));
  return (
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
          placeholder={canSend ? `Message ${channelLabel}…` : 'Connect to send messages…'}
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
  );
};
