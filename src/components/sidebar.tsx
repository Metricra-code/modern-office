import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Coffee,
  DoorOpen,
  Headphones,
  HelpCircle,
  LayoutGrid,
  Plus,
  Users,
} from 'lucide-react';
import type { Player } from '@/lib/protocol';
import { getRoom, ROOMS, type RoomId } from '@/lib/space';
import { Avatar } from './avatar';
export const roomIcons = {
  studio: LayoutGrid,
  meeting: DoorOpen,
  quiet: Headphones,
  lounge: Coffee,
};
interface SidebarProps {
  self: Player;
  players: readonly Player[];
  activeRoom: RoomId;
  view: 'office' | 'team';
  onView: (view: 'office' | 'team') => void;
  onRoom: (room: RoomId) => void;
  onProfile: () => void;
  onInvite: () => void;
  onHelp: () => void;
  isDemo: boolean;
}
export const Sidebar = ({
  self,
  players,
  activeRoom,
  view,
  onView,
  onRoom,
  onProfile,
  onInvite,
  onHelp,
  isDemo,
}: SidebarProps) => (
  <aside id="workspace-nav" className="sidebar" aria-label="Workspace navigation">
    <Link href="/" className="brand" aria-label="Modern Office home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span>
        modern<span className="brand-second">office</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
    <div className="workspace-switcher">
      <span className="workspace-symbol">M</span>
      <div>
        <strong>Modern Office</strong>
        <span>{isDemo ? 'Sample workspace' : 'Guest workspace'}</span>
      </div>
    </div>
    <nav className="primary-nav">
      <button className={view === 'office' ? 'active' : ''} onClick={() => onView('office')}>
        <LayoutGrid size={18} />
        Office<span className="nav-number">01</span>
      </button>
      <button className={view === 'team' ? 'active' : ''} onClick={() => onView('team')}>
        <Users size={18} />
        Team<span className="nav-number">{players.length}</span>
      </button>
      <Link href="/case-study/">
        <BookOpen size={18} />
        Engineering notes
        <ArrowUpRight size={14} />
      </Link>
    </nav>
    <div className="sidebar-label">
      ROOMS
      <button className="icon-button" aria-label="Invite a teammate" onClick={onInvite}>
        <Plus size={14} />
      </button>
    </div>
    <nav className="room-nav" aria-label="Office rooms">
      {ROOMS.map((room) => {
        const Icon = roomIcons[room.id];
        const count = players.filter((player) => getRoom(player) === room.id).length;
        return (
          <button
            key={room.id}
            className={activeRoom === room.id && view === 'office' ? 'room-active' : ''}
            aria-current={activeRoom === room.id && view === 'office' ? 'location' : undefined}
            onClick={() => onRoom(room.id)}
          >
            <Icon size={17} />
            <span>{room.name}</span>
            <span className="room-count">{count}</span>
            {activeRoom === room.id && view === 'office' && <span className="room-current-dot" />}
          </button>
        );
      })}
    </nav>
    <div className="sidebar-bottom">
      <button className="help-link" onClick={onHelp}>
        <HelpCircle size={17} />
        Help & shortcuts<span>?</span>
      </button>
      <button className="profile-button" onClick={onProfile}>
        <Avatar {...self} />
        <span>
          <strong>{self.name}</strong>
          <span>
            <span className={`status-dot status-${self.status}`} />
            {self.status === 'focus' ? 'Focusing' : self.status === 'away' ? 'Away' : 'Available'}
            {isDemo ? ' · Demo' : ''}
          </span>
        </span>
        <ChevronDown size={15} />
      </button>
    </div>
  </aside>
);
