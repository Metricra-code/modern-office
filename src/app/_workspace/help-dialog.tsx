import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';

const STEPS = [
  {
    title: 'Move around',
    body: 'Click a spot inside the office to relocate, or focus the map and use arrow keys / WASD. Room buttons are the accessible shortcut.',
  },
  {
    title: 'Send a message',
    body: 'Chat with everyone in General, or switch to This room. Demo messages stay in this browser.',
  },
  {
    title: 'Connect with a guest',
    body: 'Start live mode, share your invite, and click a guest to call. Both guests explicitly consent before using a camera or microphone.',
  },
] as const;

interface HelpDialogProps {
  open: boolean;
  notesHref: string;
  prefetch: boolean;
  onClose: () => void;
}
export const HelpDialog = ({ open, notesHref, prefetch, onClose }: HelpDialogProps) => (
  <Dialog open={open} title="How to use the office" onClose={onClose}>
    <p className="dialog-description">
      Use a sample workspace on your own, or invite a guest to connect live. Press ? anywhere
      outside a text field to open this guide.
    </p>
    <ol className="help-list">
      {STEPS.map((step, index) => (
        <li key={step.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="quiet-callout">
      <Info size={19} />
      <p>
        <strong>About this demo</strong>
        <span>
          This is an account-free portfolio project. Anyone with the workspace link can join, so do
          not share private information. Chat is cleared from the app when everyone leaves; the
          hosting provider may retain recovery backups.
        </span>
      </p>
    </div>
    <Link href={notesHref} prefetch={prefetch ? null : false} className="text-button">
      Read the engineering notes <ArrowUpRight size={16} />
    </Link>
  </Dialog>
);
