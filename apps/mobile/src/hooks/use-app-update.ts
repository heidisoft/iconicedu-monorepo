import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';

/** Downloads OTA updates without interrupting the session; restarting is opt-in. */
export function useAppUpdate() {
  const hasChecked = useRef(false);
  const hasPrompted = useRef(false);
  const { isUpdatePending } = Updates.useUpdates();

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

  useEffect(() => {
    // Includes downloads performed by Expo's native ON_LOAD update check.
    if (__DEV__ || !Updates.isEnabled || !isUpdatePending || hasPrompted.current) return;
    hasPrompted.current = true;

    Alert.alert(
      'Update ready',
      'A new version of ICONIC Academy is ready. Restart when you have finished your current work to apply it.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart now',
          onPress: () => {
            void Updates.reloadAsync().catch(() => {
              Alert.alert(
                'Could not restart',
                'You can keep using the app. Close and reopen it to apply the update.',
              );
            });
          },
        },
      ],
    );
  }, [isUpdatePending]);
}
