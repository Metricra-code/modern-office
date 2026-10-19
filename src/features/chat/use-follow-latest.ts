'use client';
import { useEffect, useRef, useState, type UIEvent } from 'react';

const FOLLOW_THRESHOLD_PX = 48;

/**
 * Keeps a message log pinned to its newest message while the reader is at the bottom,
 * and flags new messages instead of jumping once they scroll up to read history.
 */
export const useFollowLatest = (
  panelKey: string,
  latestId: string | undefined,
  active: boolean,
) => {
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<{ panel?: string; latest?: string; follow: boolean }>({ follow: true });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const panel = scrollRef.current;
      if (!panel?.clientHeight) return;
      const reading = readingRef.current;
      const switchedPanel = reading.panel !== panelKey;
      if (switchedPanel || reading.follow) {
        panel.scrollTop = panel.scrollHeight;
        setHasNewMessages(false);
      } else if (latestId && latestId !== reading.latest) {
        setHasNewMessages(true);
      }
      readingRef.current = {
        panel: panelKey,
        latest: latestId,
        follow: switchedPanel || reading.follow,
      };
    });
    return () => cancelAnimationFrame(frame);
  }, [active, latestId, panelKey]);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const panel = event.currentTarget;
    if (!panel.clientHeight) return;
    // Appending or switching panels can scroll via layout before the follow frame runs.
    if (readingRef.current.panel !== panelKey || readingRef.current.latest !== latestId) return;
    const follow = panel.scrollHeight - panel.clientHeight - panel.scrollTop <= FOLLOW_THRESHOLD_PX;
    readingRef.current = { ...readingRef.current, follow };
    if (follow) setHasNewMessages(false);
  };
  const jumpToLatest = () => {
    const panel = scrollRef.current;
    if (!panel) return;
    readingRef.current = { ...readingRef.current, follow: true };
    panel.scrollTop = panel.scrollHeight;
    setHasNewMessages(false);
    panel.focus();
  };
  return { scrollRef, hasNewMessages, onScroll, jumpToLatest };
};
