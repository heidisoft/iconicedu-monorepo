import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { openLiveSession } from '@/lib/messages/open-live-session';

/** iOS cannot present Safari while the ready dialog is still being dismissed. */
export function useMeetingDialogLaunch(visible: boolean) {
  const pendingHref = useRef<string | null>(null);
  const onDismiss = useCallback(() => {
    const href = pendingHref.current;
    pendingHref.current = null;
    if (href) void openLiveSession(href);
  }, []);
  useEffect(() => {
    // Android does not emit Modal.onDismiss; wait for the visibility commit.
    if (!visible && Platform.OS !== 'ios') onDismiss();
  }, [visible, onDismiss]);
  useEffect(
    () => () => {
      pendingHref.current = null;
    },
    [],
  );
  const queueLaunch = useCallback((href: string) => {
    pendingHref.current ??= href;
  }, []);
  return { queueLaunch, onDismiss };
}
