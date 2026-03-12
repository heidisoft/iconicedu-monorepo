export const DM_RECOVERY_SYNC_INTERVAL_MS = 60_000;

export function shouldSyncOnVisibility(visibilityState: string) {
  return visibilityState === 'visible';
}

export function handleDirectMessageSubscribeStatus(
  status: string,
  syncDirectMessageMemberships: () => void,
) {
  if (status === 'SUBSCRIBED') {
    syncDirectMessageMemberships();
  }
}

export function bindDirectMessageRecoveryTriggers(input: {
  syncDirectMessageMemberships: () => void;
  intervalMs?: number;
  windowObj?: Window;
  documentObj?: Document;
}) {
  const windowObj = input.windowObj ?? window;
  const documentObj = input.documentObj ?? document;
  const intervalMs = input.intervalMs ?? DM_RECOVERY_SYNC_INTERVAL_MS;

  const handleWindowFocus = () => {
    input.syncDirectMessageMemberships();
  };
  const handleVisibilityChange = () => {
    if (shouldSyncOnVisibility(documentObj.visibilityState)) {
      input.syncDirectMessageMemberships();
    }
  };

  windowObj.addEventListener('focus', handleWindowFocus);
  documentObj.addEventListener('visibilitychange', handleVisibilityChange);
  const fallbackInterval = windowObj.setInterval(() => {
    input.syncDirectMessageMemberships();
  }, intervalMs);

  return () => {
    windowObj.clearInterval(fallbackInterval);
    windowObj.removeEventListener('focus', handleWindowFocus);
    documentObj.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
