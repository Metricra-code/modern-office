'use client';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Copy, Radio } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';

interface InviteDialogProps {
  open: boolean;
  workspace: string;
  connected: boolean;
  isDemo: boolean;
  onJoinLive: () => void;
  onClose: () => void;
}
const inviteUrlFor = (workspace: string): string =>
  typeof window === 'undefined'
    ? ''
    : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/?workspace=${workspace}&mode=live`;

// Mounted per opening so the copied state starts fresh each time.
const InviteContent = ({
  workspace,
  connected,
  isDemo,
  onJoinLive,
  onClose,
}: InviteDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const inviteUrl = inviteUrlFor(workspace);
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Clipboard access is unavailable. Select and copy the link below.');
    }
  };
  return (
    <>
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
            {connected ? 'You are connected to this workspace.' : 'Join the live room to connect.'}
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
            onJoinLive();
            onClose();
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
          if (isDemo) onJoinLive();
        }}
      >
        Open a second guest <ArrowUpRight size={16} />
      </a>
    </>
  );
};
export const InviteDialog = (props: InviteDialogProps) => (
  <Dialog open={props.open} title="Invite people" onClose={props.onClose}>
    <InviteContent {...props} />
  </Dialog>
);
