import { useEffect, useRef } from 'react';
import * as Updates from 'expo-updates';

/**
 * Checks for and silently applies an EAS OTA update on first mount.
 * Skipped in development builds where expo-updates is inactive.
 * Errors are swallowed — update failure must never interrupt the user session.
 */
export function useAppUpdate() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (__DEV__ || hasChecked.current) return;
    hasChecked.current = true;

    async function applyUpdateIfAvailable() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        // Silent — never surface update errors to the user
      }
    }

    applyUpdateIfAvailable();
  }, []);
}
