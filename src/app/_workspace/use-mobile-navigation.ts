'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

const NAV_CONTROLS = '#workspace-nav a[href], #workspace-nav button:not([disabled])';
const MOBILE_QUERY = '(max-width: 760px)';

// The drawer traps focus while open and hands it back to the menu button on close.
export const useMobileNavigation = () => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    document.querySelector<HTMLAnchorElement>('#workspace-nav a')?.focus();
    return () => trigger?.focus();
  }, [open]);
  useEffect(() => {
    const viewport = window.matchMedia(MOBILE_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setOpen(false);
    };
    viewport.addEventListener('change', closeOnDesktop);
    return () => viewport.removeEventListener('change', closeOnDesktop);
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || (event.target instanceof Element && event.target.closest('dialog[open]'))) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = document.querySelectorAll<HTMLElement>(NAV_CONTROLS);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const boundary = event.shiftKey ? first : last;
    if (document.activeElement === boundary || !document.activeElement?.closest('#workspace-nav')) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };
  return { open, setOpen, triggerRef, onKeyDown };
};
