import { useEffect, useRef } from 'react';
import * as Updates from 'expo-updates';

/** Download OTA updates quietly; Expo applies them on the next cold launch. */
export function useAppUpdate() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || hasChecked.current) return;
    hasChecked.current = true;
    let active = true;

    async function downloadUpdateIfAvailable() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (active && result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline/check/download failures must not interrupt the user's session.
      }
    }

    void downloadUpdateIfAvailable();
    return () => {
      active = false;
    };
  }, []);
}
