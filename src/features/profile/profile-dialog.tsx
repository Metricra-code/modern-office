'use client';
import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { LIMITS } from '@/lib/limits';
import { AVATAR_COLORS, type Profile } from '@/lib/protocol';

interface ProfileFormProps {
  profile: Profile;
  onSave: (profile: Profile) => boolean;
  onSaved: () => void;
}
// Mounted only while the dialog is open, so each opening starts from the current profile.
const ProfileForm = ({ profile, onSave, onSaved }: ProfileFormProps) => {
  const [name, setName] = useState(profile.name);
  const [color, setColor] = useState(profile.color);
  const [error, setError] = useState('');
  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) setError('Please add a name.');
        else if (onSave({ name, color })) onSaved();
        else setError('Reconnect to save your profile. Your changes are still here.');
      }}
    >
      <label htmlFor="display-name">Your name</label>
      <input
        id="display-name"
        autoComplete="nickname"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={LIMITS.nameLength}
        required
        aria-describedby="profile-error"
      />
      <fieldset>
        <legend>Your color</legend>
        <div className="color-options">
          {AVATAR_COLORS.map((option) => (
            <label key={option} className={`color-option avatar-${option}`}>
              <input
                type="radio"
                name="color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="sr-only">{option}</span>
              {color === option && <Check size={20} />}
            </label>
          ))}
        </div>
      </fieldset>
      <p id="profile-error" className="form-error" role="status">
        {error}
      </p>
      <div className="profile-preview">
        <Avatar name={name || '?'} color={color} />
        <span>
          {name || 'Your name'}
          <small>No account needed. Your profile is only kept for this visit.</small>
        </span>
      </div>
      <button className="primary-button">
        Save profile <ArrowRight size={16} />
      </button>
    </form>
  );
};

interface ProfileDialogProps {
  open: boolean;
  profile: Profile;
  onSave: (profile: Profile) => boolean;
  onClose: () => void;
}
export const ProfileDialog = ({ open, profile, onSave, onClose }: ProfileDialogProps) => (
  <Dialog open={open} title="Edit profile" onClose={onClose}>
    <p className="dialog-description">Choose the name and color other guests see.</p>
    <ProfileForm profile={profile} onSave={onSave} onSaved={onClose} />
  </Dialog>
);
