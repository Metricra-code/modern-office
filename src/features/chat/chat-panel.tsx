'use client';
import { useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import type { Channel, ChatMessage, Player, RoomId } from '@/lib/protocol';
import { getRoomDetails } from '@/lib/space';
import { useComposerDrafts } from './composer';
import { Conversation } from './conversation';
import { PeopleView } from './people-view';

const TABS = ['general', 'room', 'people'] as const;
type ChatTab = (typeof TABS)[number];

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
  const drafts = useComposerDrafts();
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
      {tab === 'people' ? (
        <PeopleView players={players} selfId={self.id} isDemo={isDemo} onCall={onCall} />
      ) : (
        <Conversation
          tabId={`tab-${tab}`}
          channel={tab === 'room' ? room : 'general'}
          context={tab === 'room' ? getRoomDetails(room).name : 'Workspace channel'}
          channelLabel={tab === 'room' ? 'this room' : '#general'}
          messages={messages}
          selfId={self.id}
          isDemo={isDemo}
          canSend={canSend}
          active={active}
          drafts={drafts}
          onSend={onSend}
        />
      )}
    </aside>
  );
};
