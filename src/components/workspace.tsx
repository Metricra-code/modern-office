'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  Headphones,
  Info,
  Menu,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Radio,
  RefreshCw,
  Settings2,
  UserPlus,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { useOffice } from '@/hooks/use-office';
import { useCall } from '@/hooks/use-call';
import type { Player, Profile } from '@/lib/protocol';
import { workspaceRoute } from '@/lib/office-navigation';
import { getRoom, getRoomDetails, isWalkable, ROOMS, type RoomId } from '@/lib/space';
import { Avatar } from './avatar';
import { ChatPanel } from './chat-panel';
import { Dialog } from './dialog';
import { OfficeMap } from './office-map';
import { Sidebar, roomIcons } from './sidebar';
import { VideoTile } from './video-tile';

export const Workspace = () => {
  const office = useOffice();
  const call = useCall({
    incoming: office.signal,
    connected: office.connection === 'connected',
    peers: office.peers,
    send: office.sendSignal,
  });
  const [view, setView] = useState<'office' | 'team'>('office');
  const [dialog, setDialog] = useState<'profile' | 'invite' | 'help' | 'devices' | undefined>();
  const [selected, setSelected] = useState<Player>();
  const [draftName, setDraftName] = useState(office.self.name);
  const [draftColor, setDraftColor] = useState<Profile['color']>(office.self.color);
  const [profileError, setProfileError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const [mobileTab, setMobileTab] = useState<'space' | 'chat'>('space');
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileNavigation) return;
    const trigger = menuRef.current;
    document.querySelector<HTMLAnchorElement>('#workspace-nav a')?.focus();
    return () => trigger?.focus();
  }, [mobileNavigation]);
  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileNavigation(false);
    };
    viewport.addEventListener('change', closeOnDesktop);
    return () => viewport.removeEventListener('change', closeOnDesktop);
  }, []);
  const handleNavigationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !mobileNavigation ||
      (event.target instanceof Element && event.target.closest('dialog[open]'))
    )
      return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMobileNavigation(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = document.querySelectorAll<HTMLElement>(
      '#workspace-nav a[href], #workspace-nav button:not([disabled])',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    const boundary = event.shiftKey ? first : last;
    if (document.activeElement === boundary || !document.activeElement?.closest('#workspace-nav')) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };
  const players = [...office.peers, office.self];
  const activeRoom = getRoom(office.self);
  const isDemo = office.mode === 'demo';
  const connected = office.connection === 'connected';
  const room = getRoomDetails(activeRoom);
  const RoomIcon = roomIcons[activeRoom];
  const callTarget = office.peers.find((player) => player.id === call.target);
  const selectedPeer = office.peers.find((player) => player.id === selected?.id);
  const closeDialog = () => {
    setDialog(undefined);
    setCopyError('');
  };
  const openProfile = () => {
    setDraftName(office.self.name);
    setDraftColor(office.self.color);
    setProfileError('');
    setDialog('profile');
  };
  const openInvite = () => {
    setCopied(false);
    setCopyError('');
    setDialog('invite');
  };
  const selectPlayer = (player: Player) => {
    if (player.id === office.self.id) openProfile();
    else setSelected(player);
  };
  const visitRoom = (id: RoomId) => {
    // ponytail: at most 32 guests; a bounded floor scan needs no spatial-index dependency.
    const candidates = [
      getRoomDetails(id).spawn,
      ...Array.from({ length: 112 }, (_, index) => ({
        x: 65 + (index % 14) * 56,
        y: 88 + Math.floor(index / 14) * 56,
      })),
    ];
    const arrival = candidates.find(
      (point) =>
        getRoom(point) === id &&
        isWalkable(point) &&
        office.peers.every((peer) => Math.hypot(peer.x - point.x, peer.y - point.y) >= 50),
    );
    if (!arrival) {
      setRoomError(
        'No open arrival spot in this room. Try another room or wait for a guest to move.',
      );
      return;
    }
    setRoomError('');
    office.move(arrival);
    setView('office');
    setMobileTab('space');
    setMobileNavigation(false);
  };
  const inviteUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/?workspace=${office.workspace}&mode=live`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Clipboard access is unavailable. Select and copy the link below.');
    }
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
  const error = office.error || call.error || roomError;
  const notesHref = workspaceRoute('notes', office.workspace, office.mode);

  return (
    <div
      className={`app-shell ${mobileNavigation ? 'mobile-nav-open' : ''}`}
      data-mobile-tab={mobileTab}
      onKeyDown={handleNavigationKeyDown}
    >
      <a href="#main" className="skip-link" inert={mobileNavigation}>
        Skip to workspace
      </a>
      {mobileNavigation && (
        <button
          className="mobile-nav-scrim"
          onClick={() => setMobileNavigation(false)}
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
          setMobileNavigation(false);
        }}
        onRoom={visitRoom}
        onProfile={openProfile}
        onInvite={openInvite}
        onHelp={() => setDialog('help')}
        isDemo={isDemo}
      />
      <div className="workspace-main" inert={mobileNavigation}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="icon-button mobile-menu"
              aria-controls="workspace-nav"
              aria-label="Open navigation"
              aria-expanded={mobileNavigation}
              onClick={() => setMobileNavigation(!mobileNavigation)}
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
              {isDemo
                ? 'Demo workspace'
                : connected
                  ? 'Live workspace'
                  : office.connection === 'offline'
                    ? 'Offline'
                    : office.connection === 'reconnecting'
                      ? 'Reconnecting…'
                      : 'Connecting…'}
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
            <button className="primary-button" onClick={openInvite}>
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
                <button aria-pressed={mobileTab === 'space'} onClick={() => setMobileTab('space')}>
                  Office
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
                <div className="team-directory">
                  <div className="team-intro">
                    <h3>Workspace members</h3>
                    <p>
                      {isDemo
                        ? 'Sample profiles, not people currently online. Join a live room to meet other guests.'
                        : 'Guests connected to this workspace. Select someone to start a call.'}
                    </p>
                  </div>
                  {players.map((player) => (
                    <button
                      className="team-member"
                      key={player.id}
                      onClick={() => selectPlayer(player)}
                    >
                      <Avatar {...player} size="large" />
                      <span>
                        <strong>
                          {player.name}
                          {player.id === office.self.id ? ' (you)' : ''}
                        </strong>
                        <span>
                          {getRoomDetails(getRoom(player)).name} · {player.status}
                        </span>
                      </span>
                      <ArrowUpRight size={19} />
                    </button>
                  ))}
                </div>
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
                    aria-label={
                      office.self.status === 'focus' ? 'Leave focus mode' : 'Enter focus mode'
                    }
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
                      void call.preview();
                    }}
                  >
                    <Video size={19} />
                    <span>Camera</span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Edit your profile"
                    onClick={openProfile}
                  >
                    <Settings2 size={19} />
                  </button>
                </div>
              </div>
              <nav className="room-strip" aria-label="Move to a room">
                {ROOMS.map((space) => {
                  const Icon = roomIcons[space.id];
                  const count = players.filter((player) => getRoom(player) === space.id).length;
                  return (
                    <button
                      key={space.id}
                      className={space.id === activeRoom ? 'active-room-card' : ''}
                      onClick={() => visitRoom(space.id)}
                      aria-label={`Go to ${space.name}`}
                      aria-current={space.id === activeRoom ? 'location' : undefined}
                    >
                      <Icon size={16} />
                      <strong>{space.name}</strong>
                      <span>{count}</span>
                    </button>
                  );
                })}
              </nav>
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
              <Link href={notesHref}>
                Engineering notes <ArrowUpRight size={13} />
              </Link>
            </div>
          </footer>
        </main>
      </div>
      {error && (
        <div className="toast" role="alert" inert={mobileNavigation}>
          <Info size={18} />
          <p>{error}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => {
              office.clearError();
              call.clearError();
              setRoomError('');
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <Dialog open={dialog === 'profile'} title="Edit profile" onClose={closeDialog}>
        <p className="dialog-description">Choose the name and color other guests see.</p>
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draftName.trim()) {
              setProfileError('Please add a name.');
              return;
            }
            if (office.saveProfile({ name: draftName, color: draftColor })) closeDialog();
          }}
        >
          <label htmlFor="display-name">Your name</label>
          <input
            id="display-name"
            autoComplete="nickname"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            maxLength={24}
            required
            aria-describedby="profile-error"
          />
          <fieldset>
            <legend>Your color</legend>
            <div className="color-options">
              {(['terracotta', 'sage', 'blue', 'gold', 'plum'] as const).map((color) => (
                <label key={color} className={`color-option avatar-${color}`}>
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    checked={draftColor === color}
                    onChange={() => setDraftColor(color)}
                  />
                  <span className="sr-only">{color}</span>
                  {draftColor === color && <Check size={20} />}
                </label>
              ))}
            </div>
          </fieldset>
          <p id="profile-error" className="form-error" role="status">
            {profileError}
          </p>
          <div className="profile-preview">
            <Avatar name={draftName || '?'} color={draftColor} />
            <span>
              {draftName || 'Your name'}
              <small>No account needed. Your profile is only kept for this visit.</small>
            </span>
          </div>
          <button className="primary-button">
            Save profile <ArrowRight size={16} />
          </button>
        </form>
      </Dialog>
      <Dialog open={dialog === 'invite'} title="Invite people" onClose={closeDialog}>
        <p className="dialog-description">
          Share this link to join the same workspace. No account or installation needed.
        </p>
        <div className="invite-link">
          <label htmlFor="invite-url">Workspace link</label>
          <input
            id="invite-url"
            value={inviteUrl}
            readOnly
            onFocus={(event) => event.target.select()}
          />
          <button className="primary-button" onClick={() => void copyInvite()}>
            {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
          <p role="status" className="form-error">
            {copyError}
          </p>
        </div>
        <div className="quiet-callout">
          <Radio size={20} />
          <p>
            <strong>
              {connected
                ? 'You are connected to this workspace.'
                : 'Join the live room to connect.'}
            </strong>
            <span>
              Guests can see each other move, chat, and start a call. Camera and microphone are only
              shared after both guests accept.
            </span>
          </p>
        </div>
        {!connected && (
          <button
            className="text-button"
            onClick={() => {
              office.enterLive();
              closeDialog();
            }}
          >
            Join live room <ArrowRight size={16} />
          </button>
        )}
        <a
          className="text-button second-guest-link"
          href={inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (isDemo) office.enterLive();
          }}
        >
          Open a second guest <ArrowUpRight size={16} />
        </a>
      </Dialog>
      <Dialog open={dialog === 'help'} title="How to use the office" onClose={closeDialog}>
        <p className="dialog-description">
          Use a sample workspace on your own, or invite a guest to connect live.
        </p>
        <ol className="help-list">
          <li>
            <span>01</span>
            <div>
              <h3>Move around</h3>
              <p>
                Click a spot inside the office to relocate, or focus the map and use arrow keys /
                WASD. Room buttons are the accessible shortcut.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Send a message</h3>
              <p>
                Chat with everyone in General, or switch to This room. Demo messages stay in this
                browser.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Connect with a guest</h3>
              <p>
                Start live mode, share your invite, and click a guest to call. Both guests
                explicitly consent before using a camera or microphone.
              </p>
            </div>
          </li>
        </ol>
        <div className="quiet-callout">
          <Info size={19} />
          <p>
            <strong>About this demo</strong>
            <span>
              This is an account-free portfolio project. Anyone with the workspace link can join, so
              do not share private information. Chat is cleared from the app when everyone leaves;
              the hosting provider may retain recovery backups.
            </span>
          </p>
        </div>
        <Link href={notesHref} className="text-button">
          Read the engineering notes <ArrowUpRight size={16} />
        </Link>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        title={selected?.name ?? 'Teammate'}
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <div className="member-detail">
            <Avatar {...selected} size="large" />
            <p>
              {getRoomDetails(getRoom(selected)).name} · {selected.status}
            </p>
            {isDemo ? (
              <>
                <p className="dialog-description">
                  This is a sample teammate, not a real person online. Invite a guest to try a real
                  video call.
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSelected(undefined);
                    office.enterLive();
                  }}
                >
                  Connect live <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                {connected && !selectedPeer && (
                  <p className="dialog-description" role="status">
                    This guest has left the workspace.
                  </p>
                )}
                <button
                  className="primary-button"
                  disabled={!connected || !selectedPeer || call.phase !== 'idle'}
                  onClick={() => startCall(selected)}
                >
                  <Phone size={17} />
                  Start a video call
                </button>
              </>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={dialog === 'devices' && call.phase === 'idle'}
        title="Camera preview"
        onClose={() => {
          closeDialog();
          call.end();
        }}
      >
        <p className="dialog-description">
          Local preview only. Your microphone is not captured or shared.
        </p>
        <VideoTile
          stream={call.localStream}
          muted
          label="Your local preview"
          cameraOff={call.cameraOff}
        />
        <div className="call-actions">
          <button
            className="secondary-button"
            disabled={!call.localStream}
            onClick={call.toggleCamera}
          >
            {call.cameraOff ? <Video size={17} /> : <VideoOff size={17} />}Toggle camera
          </button>
          <button className="text-button" onClick={() => void call.preview()}>
            Retry camera
          </button>
        </div>
        <p className="form-error" role="status">
          {call.error}
        </p>
      </Dialog>
      <Dialog
        open={call.phase !== 'idle'}
        title={
          call.phase === 'incoming'
            ? `${callTarget?.name ?? 'A guest'} is calling.`
            : `Call with ${callTarget?.name ?? 'your teammate'}`
        }
        onClose={call.end}
        wide
      >
        <p className="dialog-description" role="status">
          {call.phase === 'incoming'
            ? 'Accept to share your camera and microphone. You are in control.'
            : call.phase === 'outgoing'
              ? 'Waiting for your teammate to accept…'
              : call.phase === 'connecting'
                ? 'Connecting directly with WebRTC…'
                : 'Connected · Direct peer-to-peer video'}
        </p>
        {call.phase === 'incoming' ? (
          <div className="call-actions">
            <button className="secondary-button" onClick={call.decline}>
              <PhoneOff size={17} />
              Decline
            </button>
            <button className="primary-button" onClick={() => void call.accept()}>
              <Phone size={17} />
              Accept call
            </button>
          </div>
        ) : (
          <>
            <div className="video-grid">
              <VideoTile stream={call.localStream} muted label="You" cameraOff={call.cameraOff} />
              <VideoTile stream={call.remoteStream} label={callTarget?.name ?? 'Teammate'} />
            </div>
            <div className="call-actions">
              <button
                className="secondary-button"
                aria-pressed={call.muted}
                onClick={call.toggleMic}
              >
                {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
                {call.muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                className="secondary-button"
                aria-pressed={call.cameraOff}
                onClick={call.toggleCamera}
              >
                {call.cameraOff ? <VideoOff size={18} /> : <Video size={18} />}Camera
              </button>
              <button className="danger-button" onClick={call.end}>
                <PhoneOff size={18} />
                End call
              </button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};
