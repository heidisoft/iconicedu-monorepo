import { useCallback, useEffect, useRef, useState } from 'react';
import type { UUID } from '@iconicedu/shared-types';

const UNREAD_DIVIDER_DISMISS_MS = 280;

type UseUnreadIndicatorInput = {
  unreadAnchorMessageId: UUID | null;
  latestMessageId: UUID | null;
  onUnreadViewed?: (lastReadMessageId: UUID) => void;
};

export function useUnreadIndicator({
  unreadAnchorMessageId,
  latestMessageId,
  onUnreadViewed,
}: UseUnreadIndicatorInput) {
  const dismissTimeoutRef = useRef<number | null>(null);
  const unreadViewNotifiedForAnchorRef = useRef<string | null>(null);
  const [dismissedUnreadAnchorId, setDismissedUnreadAnchorId] = useState<string | null>(
    null,
  );
  const [isUnreadDividerDismissing, setIsUnreadDividerDismissing] = useState(false);

  const dismissUnreadDivider = useCallback(() => {
    if (!unreadAnchorMessageId || dismissedUnreadAnchorId === unreadAnchorMessageId) {
      return;
    }
    if (isUnreadDividerDismissing) {
      return;
    }

    if (
      onUnreadViewed &&
      latestMessageId &&
      unreadViewNotifiedForAnchorRef.current !== unreadAnchorMessageId
    ) {
      unreadViewNotifiedForAnchorRef.current = unreadAnchorMessageId;
      onUnreadViewed(latestMessageId);
    }

    setIsUnreadDividerDismissing(true);
    dismissTimeoutRef.current = window.setTimeout(() => {
      setDismissedUnreadAnchorId(unreadAnchorMessageId);
      setIsUnreadDividerDismissing(false);
    }, UNREAD_DIVIDER_DISMISS_MS);
  }, [
    unreadAnchorMessageId,
    dismissedUnreadAnchorId,
    isUnreadDividerDismissing,
    onUnreadViewed,
    latestMessageId,
  ]);

  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        window.clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!unreadAnchorMessageId || dismissedUnreadAnchorId === unreadAnchorMessageId) {
      return;
    }
    unreadViewNotifiedForAnchorRef.current = null;
    setIsUnreadDividerDismissing(false);
  }, [unreadAnchorMessageId, dismissedUnreadAnchorId]);

  return {
    dismissedUnreadAnchorId,
    isUnreadDividerDismissing,
    dismissUnreadDivider,
  };
}
