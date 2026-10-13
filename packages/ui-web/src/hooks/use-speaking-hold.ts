'use client';
import { useEffect, useState } from 'react';
export const SPEAKING_HOLD_MS = 1800;
/** Brief pauses keep the indicator visible; disabling audio cancels it immediately. */
export function useSpeakingHold(speaking: boolean, enabled = true) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setHeld(false);
      return;
    }
    if (speaking) {
      setHeld(true);
      return;
    }
    const timer = setTimeout(() => setHeld(false), SPEAKING_HOLD_MS);
    return () => clearTimeout(timer);
  }, [speaking, enabled]);
  return enabled && (speaking || held);
}
