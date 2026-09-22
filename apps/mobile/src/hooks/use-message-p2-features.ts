import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPinnedMessages,
  scheduleMessage,
  toggleMessagePin,
} from '@/lib/api/queries';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';

// ─── Shared P2 messaging feature state (issue #264) ────────────────────────
//
// Bundles the pinning / search / scheduled-send flag reads, the pinned-ids
// query + toggle handler, and the three sheets' visibility + search-result
// "jump to message" state, so `channel/[channelId].tsx`, `dm/[channelId].tsx`
// and `spaces/[channelId].tsx` don't each re-implement the same wiring.

const HIGHLIGHT_CLEAR_DELAY_MS = 2500;

export function useMessageP2Features(input: {
  orgId: string;
  channelId: string;
  profileId: string;
  accountId: string;
}) {
  const { orgId, channelId, profileId, accountId } = input;

  const enablePinning = useMobileFeatureFlag(mobileFeatureFlagKeys.enableMessagePinning);
  const enableSearch = useMobileFeatureFlag(mobileFeatureFlagKeys.enableMessageSearch);
  const enableScheduledSend = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableScheduledSend,
  );

  const pinnedQuery = useQuery({
    queryKey: ['message-pins', orgId, channelId, profileId],
    queryFn: () => fetchPinnedMessages({ orgId, channelId, profileId, accountId }),
    enabled: enablePinning && !!orgId && !!channelId && !!profileId && !!accountId,
    staleTime: 30_000,
  });

  const pinnedMessageIds = useMemo(() => {
    const rows = Array.isArray(pinnedQuery.data) ? pinnedQuery.data : [];
    return new Set(rows.map((row) => row.message.ids.id));
  }, [pinnedQuery.data]);

  const handleTogglePin = useCallback(
    async (messageId: string, nextPinned: boolean) => {
      await toggleMessagePin({
        orgId,
        channelId,
        messageId,
        isPinned: nextPinned,
        profileId,
      });
      await pinnedQuery.refetch();
    },
    [orgId, channelId, profileId, pinnedQuery],
  );

  const [pinnedSheetVisible, setPinnedSheetVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [scheduledSheetVisible, setScheduledSheetVisible] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jumpToMessage = useCallback((messageId: string) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightMessageId(messageId);
  }, []);

  const handleScrollToMessageResult = useCallback((found: boolean) => {
    if (!found) {
      Alert.alert(
        'Message not currently loaded',
        'Scroll up to load older messages, then try again.',
      );
      setHighlightMessageId(null);
      return;
    }
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightMessageId(null);
    }, HIGHLIGHT_CLEAR_DELAY_MS);
  }, []);

  const scheduleSend = useCallback(
    async (message: { content: string; sendAt: string; timezone: string | null }) => {
      await scheduleMessage({
        orgId,
        channelId,
        senderProfileId: profileId,
        content: message.content,
        sendAt: message.sendAt,
        timezone: message.timezone,
      });
      Alert.alert('Message scheduled', "It'll send automatically at the scheduled time.");
    },
    [orgId, channelId, profileId],
  );

  return {
    enablePinning,
    enableSearch,
    enableScheduledSend,
    pinnedMessageIds,
    handleTogglePin,
    pinnedSheetVisible,
    openPinnedSheet: useCallback(() => setPinnedSheetVisible(true), []),
    closePinnedSheet: useCallback(() => setPinnedSheetVisible(false), []),
    searchVisible,
    openSearch: useCallback(() => setSearchVisible(true), []),
    closeSearch: useCallback(() => setSearchVisible(false), []),
    scheduledSheetVisible,
    openScheduledSheet: useCallback(() => setScheduledSheetVisible(true), []),
    closeScheduledSheet: useCallback(() => setScheduledSheetVisible(false), []),
    highlightMessageId,
    jumpToMessage,
    handleScrollToMessageResult,
    scheduleSend,
  };
}
