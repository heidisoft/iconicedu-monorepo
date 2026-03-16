import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

const TYPING_TIMEOUT_MS = 3000;

type TypingPayload = { profileId: string; name: string };

/**
 * Subscribes to typing broadcast events for a channel.
 * Broadcasts a typing event when the current user is typing.
 *
 * Returns:
 *  - `typingUsers` — display names of users currently typing (excluding self)
 *  - `broadcastTyping` — call this when the local user is typing
 */
export function useTyping(channelId: string, myName: string, myProfileId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!channelId) return;

    const ch = supabase.channel(`typing:${channelId}`);
    channelRef.current = ch;
    const timeouts = timeoutsRef.current;

    ch.on('broadcast', { event: 'typing' }, ({ payload }: { payload: TypingPayload }) => {
      const { profileId, name } = payload;
      // Ignore our own events
      if (profileId === myProfileId) return;

      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));

      // Reset the auto-remove timer for this user
      const existing = timeoutsRef.current.get(profileId);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== name));
        timeoutsRef.current.delete(profileId);
      }, TYPING_TIMEOUT_MS);

      timeoutsRef.current.set(profileId, timeout);
    }).subscribe();

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      setTypingUsers([]);
    };
  }, [channelId, myProfileId]);

  // Throttle: track last-sent time to avoid flooding the channel
  const lastSentRef = useRef(0);

  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || !myProfileId || !channelId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 1500) return; // throttle to ~1.5 s
    lastSentRef.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { profileId: myProfileId, name: myName } satisfies TypingPayload,
    });
  }, [channelId, myName, myProfileId]);

  return { typingUsers, broadcastTyping };
}
