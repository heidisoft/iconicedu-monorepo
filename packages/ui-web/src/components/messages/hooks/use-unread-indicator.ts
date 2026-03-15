import { useCallback, useEffect, useRef, useState } from 'react';

const UNREAD_DIVIDER_DISMISS_MS = 900;

type UseUnreadIndicatorInput = {
  unreadAnchorMessageId: string | null;
};

export function useUnreadIndicator({ unreadAnchorMessageId }: UseUnreadIndicatorInput) {
  const dismissTimeoutRef = useRef<number | null>(null);
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

    setIsUnreadDividerDismissing(true);
    dismissTimeoutRef.current = window.setTimeout(() => {
      setDismissedUnreadAnchorId(unreadAnchorMessageId);
      setIsUnreadDividerDismissing(false);
    }, UNREAD_DIVIDER_DISMISS_MS);
  }, [unreadAnchorMessageId, dismissedUnreadAnchorId, isUnreadDividerDismissing]);

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
    setIsUnreadDividerDismissing(false);
  }, [unreadAnchorMessageId, dismissedUnreadAnchorId]);

  return {
    dismissedUnreadAnchorId,
    isUnreadDividerDismissing,
    dismissUnreadDivider,
  };
}
