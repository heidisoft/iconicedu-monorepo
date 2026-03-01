import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { queryKeys, fetchChannelMessages, toggleReaction as apiToggleReaction } from '@/lib/api/queries';
import { supabase } from '@/lib/supabase/client';
import type { MessageVM, ReactionVM } from '@iconicedu/shared-types';

// ─── Typing constants ─────────────────────────────────────────────────────────

const TYPING_REMOTE_TIMEOUT_MS = 4000;  // remove user from list after this long without an event
const TYPING_THROTTLE_MS = 1500;        // min interval between start broadcasts
const TYPING_STOP_DELAY_MS = 2500;      // auto-send stop after this much inactivity

type TypingPayload = {
  profileId?: string;
  name?: string;      // included by mobile; absent in web payloads
  isTyping?: boolean; // true = start, false = stop; absent in legacy mobile payloads
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMessages(
  channelId: string,
  currentProfileId = '',
  currentAccountId = '',
  /** Display name of the local user — used in outgoing typing broadcasts. */
  myTypingName = '',
  /** org_id — enables threads table realtime subscription for reply-count updates. */
  orgId = '',
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: () => fetchChannelMessages(channelId, currentProfileId, currentAccountId),
    enabled: !!channelId,
  });

  // ── Typing state ──────────────────────────────────────────────────────────

  /** profileId → displayName for users currently typing */
  const [typingMap, setTypingMap] = useState<Map<string, string>>(new Map());

  // Stable refs so typing callbacks don't need to be recreated on every render
  const myTypingNameRef = useRef(myTypingName);
  const currentProfileIdRef = useRef(currentProfileId);
  useEffect(() => { myTypingNameRef.current = myTypingName; }, [myTypingName]);
  useEffect(() => { currentProfileIdRef.current = currentProfileId; }, [currentProfileId]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSentRef = useRef(0);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Realtime subscription (messages + threads + typing) ──────────────────

  useEffect(() => {
    if (!channelId) return;

    const ch = supabase
      .channel(`messages:${channelId}`)
      // ── Postgres changes: messages table ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      // ── Postgres changes: message payload tables ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_text' },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      // ── Postgres changes: threads table (reply count updates) ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
          ...(orgId ? { filter: `org_id=eq.${orgId}` } : {}),
        },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }); },
      )
      // ── Broadcast: typing events (shared channel with web) ──
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: TypingPayload }) => {
        const { profileId, name, isTyping } = payload;
        if (!profileId || profileId === currentProfileIdRef.current) return;

        // Resolve display name: use name from payload if present,
        // otherwise look up from cached messages (web omits name).
        const resolveDisplayName = () => {
          if (name) return name;
          const msgs = queryClient.getQueryData<MessageVM[]>(queryKeys.messages(channelId));
          const found = msgs?.find((m) => m.core.sender.ids.id === profileId);
          return found?.core.sender.profile.displayName ?? 'Someone';
        };

        if (isTyping === false) {
          // Explicit stop event (web sends isTyping: false)
          const t = remoteTimeoutsRef.current.get(profileId);
          if (t) clearTimeout(t);
          remoteTimeoutsRef.current.delete(profileId);
          setTypingMap((prev) => {
            const next = new Map(prev);
            next.delete(profileId);
            return next;
          });
          return;
        }

        // Typing start (isTyping: true, or legacy mobile with no isTyping field)
        const displayName = resolveDisplayName();
        setTypingMap((prev) => {
          if (prev.get(profileId) === displayName) return prev;
          const next = new Map(prev);
          next.set(profileId, displayName);
          return next;
        });

        // Reset the auto-remove timer
        const t = remoteTimeoutsRef.current.get(profileId);
        if (t) clearTimeout(t);
        const timeout = setTimeout(() => {
          setTypingMap((prev) => {
            const next = new Map(prev);
            next.delete(profileId);
            return next;
          });
          remoteTimeoutsRef.current.delete(profileId);
        }, TYPING_REMOTE_TIMEOUT_MS);
        remoteTimeoutsRef.current.set(profileId, timeout);
      });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      remoteTimeoutsRef.current.forEach((t) => clearTimeout(t));
      remoteTimeoutsRef.current.clear();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      setTypingMap(new Map());
    };
  }, [channelId, orgId, queryClient]); // currentProfileId via ref — stable without re-subscribing

  // ── Typing broadcast ──────────────────────────────────────────────────────

  /** Send a typing start/stop broadcast on the shared messages channel. */
  const sendTypingBroadcast = useCallback((isTyping: boolean) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        profileId: currentProfileIdRef.current,
        name: myTypingNameRef.current,
        isTyping,
      } satisfies TypingPayload,
    });
  }, []); // refs only — no deps needed

  /** Call on each keystroke to broadcast typing start (throttled). */
  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || !currentProfileIdRef.current) return;
    const now = Date.now();
    if (!isTypingRef.current || now - lastSentRef.current >= TYPING_THROTTLE_MS) {
      isTypingRef.current = true;
      lastSentRef.current = now;
      sendTypingBroadcast(true);
    }
    // Schedule an automatic stop after inactivity
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingBroadcast(false);
    }, TYPING_STOP_DELAY_MS);
  }, [sendTypingBroadcast]);

  /** Call when the user sends a message or clears the input. */
  const broadcastTypingStop = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingBroadcast(false);
    }
  }, [sendTypingBroadcast]);

  const typingUsers = useMemo(() => Array.from(typingMap.values()), [typingMap]);

  // ── Load more ─────────────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!query.data?.length) return;
    const oldest = query.data[0];
    if (!oldest) return;

    const olderMessages = await fetchChannelMessages(
      channelId,
      currentProfileId,
      currentAccountId,
      40,
      oldest.core.createdAt,
    );

    queryClient.setQueryData(
      queryKeys.messages(channelId),
      (prev: typeof query.data) => [...olderMessages, ...(prev ?? [])],
    );
  }, [channelId, currentProfileId, currentAccountId, query.data, queryClient]);

  // ── Reaction toggle ───────────────────────────────────────────────────────

  /**
   * Optimistically toggles a reaction in the cache, then calls the API.
   * Falls back to invalidate on error so the UI stays correct.
   */
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const key = queryKeys.messages(channelId);

      // Snapshot for rollback
      const previous = queryClient.getQueryData<MessageVM[]>(key);

      // Optimistic update
      queryClient.setQueryData<MessageVM[]>(key, (msgs) => {
        if (!msgs) return msgs;
        return msgs.map((msg) => {
          if (msg.ids.id !== messageId) return msg;

          const reactions: ReactionVM[] = msg.social?.reactions ?? [];
          const existing = reactions.find((r) => r.emoji === emoji);

          let nextReactions: ReactionVM[];
          if (existing?.reactedByMe) {
            // Remove my reaction
            nextReactions = existing.count <= 1
              ? reactions.filter((r) => r.emoji !== emoji)
              : reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count - 1, reactedByMe: false }
                    : r,
                );
          } else if (existing) {
            // Add my reaction to an existing emoji group (others reacted, I haven't yet)
            nextReactions = reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, reactedByMe: true }
                : r,
            );
          } else {
            // New emoji — toggle on
            nextReactions = [
              ...reactions,
              { emoji, count: 1, reactedByMe: true, sampleUserIds: [currentAccountId] },
            ];
          }

          return { ...msg, social: { ...msg.social, reactions: nextReactions } };
        });
      });

      try {
        // message_reactions uses account_id
        await apiToggleReaction(messageId, currentAccountId, emoji);
      } catch {
        // Roll back on error
        queryClient.setQueryData(key, previous);
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [channelId, currentAccountId, queryClient],
  );

  return {
    ...query,
    loadMore,
    toggleReaction,
    typingUsers,
    broadcastTyping,
    broadcastTypingStop,
  };
}
