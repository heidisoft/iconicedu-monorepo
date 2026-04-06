import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getExpoPushToken, storePushToken } from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f172a',
  });
}

/**
 * Manages push notification registration for the authenticated user.
 *
 * Returns `showConsent: true` when the OS permission is undetermined —
 * the caller should render a pre-permission consent sheet, then call
 * `onConsentGranted()` if the user agrees, or `onConsentDismissed()` if not.
 *
 * When permission is already granted, token registration happens silently.
 * Errors are caught silently — push registration must never block the user.
 */
export function usePushRegistration() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  const [showConsent, setShowConsent] = useState(false);
  const registered = useRef(false);

  useEffect(() => {
    if (!orgId || !profileId || registered.current) return;

    void (async () => {
      try {
        await ensureAndroidChannel();
        const { status } = await Notifications.getPermissionsAsync();

        if (status === 'undetermined') {
          setShowConsent(true);
          return;
        }

        if (status !== 'granted') return;

        registered.current = true;
        const token = await getExpoPushToken();
        if (token) await storePushToken(orgId, profileId, token);
      } catch {
        // Push registration errors must never surface to the user
      }
    })();
  }, [orgId, profileId]);

  const onConsentGranted = async () => {
    setShowConsent(false);
    if (!orgId || !profileId) return;
    try {
      const token = await getExpoPushToken();
      if (token) {
        registered.current = true;
        await storePushToken(orgId, profileId, token);
      }
    } catch {
      // Silent — consent was granted but token fetch failed; user can still use the app
    }
  };

  const onConsentDismissed = () => {
    setShowConsent(false);
  };

  return { showConsent, onConsentGranted, onConsentDismissed };
}
