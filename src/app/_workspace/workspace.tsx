'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Headphones,
  Info,
  Menu,
  Radio,
  RefreshCw,
  Settings2,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { CallDialog } from '@/features/call/call-dialog';
import { CameraPreviewDialog } from '@/features/call/camera-preview-dialog';
import { useCall } from '@/features/call/use-call';
import { useLocalMedia } from '@/features/call/use-local-media';
import { ChatPanel } from '@/features/chat/chat-panel';
import { OfficeMap } from '@/features/office/office-map';
import { ROOM_ICONS } from '@/features/office/room-icons';
import { RoomStrip } from '@/features/office/room-strip';
import { TeamDirectory } from '@/features/office/team-directory';
import { ProfileDialog } from '@/features/profile/profile-dialog';
import { useOffice, type ConnectionState } from '@/features/realtime/use-office';
import type { Player, RoomId } from '@/lib/protocol';
import { workspaceRoute } from '@/lib/routes';
import { findOpenSpot, getRoom, getRoomDetails } from '@/lib/space';
import { HelpDialog } from './help-dialog';
import { InviteDialog } from './invite-dialog';
import { MemberDialog } from './member-dialog';
import { Sidebar } from './sidebar';
import { useMobileNavigation } from './use-mobile-navigation';

type WorkspaceDialog = 'profile' | 'invite' | 'help' | 'devices';
const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
const CONNECTION_LABEL: Record<ConnectionState, string> = {
  demo: 'Demo workspace',
  connected: 'Live workspace',
  offline: 'Offline',
  reconnecting: 'Reconnecting…',
  connecting: 'Connecting…',
};

export const Workspace = () => {
  const office = useOffice();
  const media = useLocalMedia();
  const call = useCall({
    media,
    subscribeSignals: office.subscribeSignals,
    connected: office.connection === 'connected',
    peers: office.peers,
    send: office.sendSignal,
  });
  const {
    open: navigationOpen,
    setOpen: setNavigationOpen,
    triggerRef: menuRef,
    onKeyDown: handleNavigationKeyDown,
  } = useMobileNavigation();
  const [view, setView] = useState<'office' | 'team'>('office');
  const [dialog, setDialog] = useState<WorkspaceDialog>();
  const [selected, setSelected] = useState<Player>();
  const [roomError, setRoomError] = useState('');
  const [mobileTab, setMobileTab] = useState<'space' | 'chat'>('space');

  const players = [...office.peers, office.self];
  const activeRoom = getRoom(office.self);
  const isDemo = office.mode === 'demo';
  const connected = office.connection === 'connected';
  const room = getRoomDetails(activeRoom);
  const RoomIcon = ROOM_ICONS[activeRoom];
  const callTarget = office.peers.find((player) => player.id === call.target);
  const selectedPeer = office.peers.find((player) => player.id === selected?.id);
  const error = office.error || call.error || media.error || roomError;
  const notesHref = workspaceRoute('notes', office.workspace, office.mode);
  const closeDialog = () => setDialog(undefined);
  useEffect(() => {
    const openHelp = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setDialog('help');
    };
    window.addEventListener('keydown', openHelp);
    return () => window.removeEventListener('keydown', openHelp);
  }, []);

  const showSpace = () => {
    setMobileTab('space');
    setNavigationOpen(false);
  };
  const selectPlayer = (player: Player) => {
    if (player.id === office.self.id) setDialog('profile');
    else setSelected(player);
  };
  const visitRoom = (id: RoomId) => {
    const arrival = findOpenSpot(office.peers, getRoomDetails(id).spawn, id);
    if (!arrival) {
      setRoomError(
        'No open arrival spot in this room. Try another room or wait for a guest to move.',
      );
      return;
    }
    setRoomError('');
    office.move(arrival);
    setView('office');
    showSpace();
  };
  const startCall = (player: Player) => {
    const peer = office.peers.find((candidate) => candidate.id === player.id);
    if (!connected || !peer) {
      setSelected(player);
      return;
    }
    setSelected(undefined);
    void call.start(peer.id);
  };

  return (
    <>
      <p className="sr-only" role="status">
        {!office.initialized ? 'Preparing your workspace…' : ''}
      </p>
      <div
        className={`app-shell ${navigationOpen ? 'mobile-nav-open' : ''}`}
        data-mobile-tab={mobileTab}
        inert={!office.initialized}
        aria-busy={!office.initialized}
        onKeyDown={handleNavigationKeyDown}
      >
        <a href="#main" className="skip-link" inert={navigationOpen}>
          Skip to workspace
        </a>
        {navigationOpen && (
          <button
            className="mobile-nav-scrim"
            onClick={() => setNavigationOpen(false)}
            aria-label="Close navigation"
          />
        )}
        <Sidebar
          workspace={office.workspace}
          self={office.self}
          players={players}
          activeRoom={activeRoom}
          view={view}
          onView={(next) => {
            setView(next);
            showSpace();
          }}
          onRoom={visitRoom}
          onProfile={() => setDialog('profile')}
          onInvite={() => setDialog('invite')}
          onHelp={() => setDialog('help')}
          isDemo={isDemo}
          initialized={office.initialized}
        />
        <div className="workspace-main" inert={navigationOpen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                ref={menuRef}
                className="icon-button mobile-menu"
                aria-controls="workspace-nav"
                aria-label="Open navigation"
                aria-expanded={navigationOpen}
                onClick={() => setNavigationOpen(!navigationOpen)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{view === 'office' ? 'Office' : 'Team'}</strong>
            </div>
            <div className="topbar-actions">
              <span className={`connection-pill connection-${office.connection}`} role="status">
                <span className="status-dot" />
                {office.initialized ? CONNECTION_LABEL[office.connection] : 'Preparing…'}
              </span>
              <button
                className="icon-button"
                aria-label="Help and keyboard shortcuts"
                onClick={() => setDialog('help')}
              >
                <CircleHelp size={19} />
              </button>
            </div>
          </header>
          <main id="main" className="main-content" tabIndex={-1}>
            <section className="welcome">
              <div>
                <h1>{view === 'office' ? 'Office' : 'Team'}</h1>
                <p>
                  {isDemo
                    ? 'Explore the sample office, or invite someone to a live room.'
                    : 'Move around, send a message, or call another guest.'}
                </p>
              </div>
              <button className="primary-button" onClick={() => setDialog('invite')}>
                <UserPlus size={17} />
                Invite people
              </button>
            </section>
            <div className="workspace-grid">
              <section
                className="space-column"
                aria-label={view === 'office' ? 'Office space' : 'Team directory'}
              >
                <div className="space-heading">
                  <div className="space-heading-title">
                    <h2>{view === 'office' ? 'Floor 01' : 'Directory'}</h2>
                    <span className="space-label">
                      {isDemo ? 'SAMPLE WORKSPACE' : 'GUEST WORKSPACE'}
                    </span>
                  </div>
                  <div className="occupancy">
                    <div className="avatar-stack">
                      {players.slice(0, 4).map((player) => (
                        <Avatar key={player.id} {...player} size="small" />
                      ))}
                    </div>
                    <span>
                      <strong>{players.length}</strong> {isDemo ? 'in demo' : 'online'}
                    </span>
                  </div>
                </div>
                <div className="mobile-workspace-tabs">
                  <button
                    aria-pressed={mobileTab === 'space'}
                    onClick={() => setMobileTab('space')}
                  >
                    {view === 'office' ? 'Office' : 'Team'}
                  </button>
                  <button aria-pressed={mobileTab === 'chat'} onClick={() => setMobileTab('chat')}>
                    Conversations <span>{office.messages.length}</span>
                  </button>
                </div>
                {view === 'office' ? (
                  <OfficeMap
                    self={office.self}
                    peers={office.peers}
                    onMove={office.move}
                    onSelect={selectPlayer}
                  />
                ) : (
                  <TeamDirectory
                    players={players}
                    selfId={office.self.id}
                    isDemo={isDemo}
                    onSelect={selectPlayer}
                  />
                )}
                <div className="space-controlbar">
                  <div className="current-room">
                    <span className="current-room-icon">
                      <RoomIcon size={19} />
                    </span>
                    <div>
                      <strong>{room.name}</strong>
                      <span>{room.description}</span>
                    </div>
                  </div>
                  <div className="device-controls">
                    <button
                      className={`device-button ${office.self.status === 'focus' ? 'device-active' : ''}`}
                      aria-label="Focus mode"
                      aria-pressed={office.self.status === 'focus'}
                      onClick={() =>
                        office.changeStatus(office.self.status === 'focus' ? 'available' : 'focus')
                      }
                    >
                      <Headphones size={18} />
                      <span>Focus</span>
                    </button>
                    <button
                      className="device-button"
                      aria-label="Test camera"
                      onClick={() => {
                        setDialog('devices');
                        if (call.phase === 'idle') void media.capture(false);
                      }}
                    >
                      <Video size={19} />
                      <span>Camera</span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Edit your profile"
                      onClick={() => setDialog('profile')}
                    >
                      <Settings2 size={19} />
                    </button>
                  </div>
                </div>
                <RoomStrip players={players} activeRoom={activeRoom} onRoom={visitRoom} />
              </section>
              <ChatPanel
                messages={office.messages}
                players={players}
                self={office.self}
                room={activeRoom}
                isDemo={isDemo}
                active={mobileTab === 'chat'}
                canSend={isDemo || connected}
                onSend={office.chat}
                onCall={startCall}
              />
            </div>
            <footer className="app-footer">
              <span>
                {isDemo
                  ? 'Demo · messages stay in this browser'
                  : 'Guest session · no account required'}
              </span>
              <div>
                {isDemo ? (
                  <button onClick={office.enterLive}>
                    <Radio size={13} />
                    Join live room
                  </button>
                ) : (
                  <>
                    <button onClick={office.enterDemo}>View demo</button>
                    {!connected && (
                      <button onClick={office.enterLive}>
                        <RefreshCw size={13} />
                        Reconnect
                      </button>
                    )}
                  </>
                )}
                <Link href={notesHref} prefetch={office.initialized ? null : false}>
                  Engineering notes <ArrowUpRight size={13} />
                </Link>
              </div>
            </footer>
          </main>
        </div>
        {error && (
          <div className="toast" role="alert" inert={navigationOpen}>
            <Info size={18} />
            <p>{error}</p>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => {
                office.clearError();
                call.clearError();
                media.clearError();
                setRoomError('');
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <ProfileDialog
          open={dialog === 'profile'}
          profile={office.self}
          onSave={office.saveProfile}
          onClose={closeDialog}
        />
        <InviteDialog
          open={dialog === 'invite'}
          workspace={office.workspace}
          connected={connected}
          isDemo={isDemo}
          onJoinLive={office.enterLive}
          onClose={closeDialog}
        />
        <HelpDialog
          open={dialog === 'help'}
          notesHref={notesHref}
          prefetch={office.initialized}
          onClose={closeDialog}
        />
        <MemberDialog
          member={selected}
          isDemo={isDemo}
          connected={connected}
          present={Boolean(selectedPeer)}
          canCall={connected && Boolean(selectedPeer) && call.phase === 'idle'}
          onConnectLive={() => {
            setSelected(undefined);
            office.enterLive();
          }}
          onCall={startCall}
          onClose={() => setSelected(undefined)}
        />
        <CameraPreviewDialog
          open={dialog === 'devices' && call.phase === 'idle'}
          media={media}
          onClose={closeDialog}
        />
        <CallDialog call={call} media={media} peerName={callTarget?.name} />
      </div>
    </>
  );
};
