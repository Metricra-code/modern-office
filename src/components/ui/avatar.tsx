import type { Profile } from '@/lib/protocol';
export const Avatar = ({
  name,
  color,
  size = 'normal',
}: Profile & { size?: 'small' | 'normal' | 'large' }) => (
  <span className={`avatar avatar-${color} avatar-${size}`} aria-hidden="true">
    {name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()}
  </span>
);
