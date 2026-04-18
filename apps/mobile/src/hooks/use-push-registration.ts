import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  storePushToken,
  supportsNativePushNotifications,
} from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

const CONSENT_SHOWN_KEY = 'push_consent_shown';
function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotificationsModule();
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
 * Shows a custom consent sheet on first run before touching OS permissions.
 * This is required because:
 * - iOS: the OS prompt can only be shown once — we explain why first
 * - Android < 13: permissions are auto-granted, so the OS never shows a prompt
 *   at all; our sheet is the only way to inform the user
 * - Android 13+: runtime permission required, same as iOS
 *
 * After the user consents (or if permission was already granted from a
 * previous install), token registration happens silently.
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
        if (!supportsNativePushNotifications()) {
          return;
        }

        await ensureAndroidChannel();
        const Notifications = getNotificationsModule();
        const { status } = await Notifications.getPermissionsAsync();

        // If already explicitly denied, nothing to do — user must go to Settings
        if (status === 'denied') {
          return;
        }

        const consentShown = await SecureStore.getItemAsync(CONSENT_SHOWN_KEY);

        if (!consentShown && status !== 'granted') {
          // First run on a supported device with notifications not yet granted:
          // show the explainer sheet before requesting the OS permission prompt.
          setShowConsent(true);
          return;
        }

        // Consent sheet was already shown, but OS permission may never have been requested
        // (e.g. user tapped "Not Now", or CONSENT_SHOWN_KEY persisted from a prior install
        // since SecureStore survives Android reinstalls via EncryptedSharedPreferences).
        // Re-show the sheet so they get another chance. Only permanently bail on explicit denial.
        if (status === 'undetermined') {
          setShowConsent(true);
          return;
        }
        if (status !== 'granted') {
          return;
        }
        registered.current = true;
        const token = await getExpoPushToken();
        if (token) {
          await storePushToken(orgId, profileId, token);
        }
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.notifications.use_push_registration',
          message: 'Push registration failed during automatic registration',
          context: { orgId, profileId },
        });
      }
    })();
  }, [orgId, profileId]);

  const onConsentGranted = async () => {
    setShowConsent(false);
    await SecureStore.setItemAsync(CONSENT_SHOWN_KEY, '1');
    if (!orgId || !profileId) return;
    try {
      const token = await getExpoPushToken();
      if (token) {
        registered.current = true;
        await storePushToken(orgId, profileId, token);
      }
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.notifications.use_push_registration.on_consent_granted',
        message: 'Push registration failed after consent was granted',
        context: { orgId, profileId },
      });
    }
  };

  const onConsentDismissed = async () => {
    setShowConsent(false);
    await SecureStore.setItemAsync(CONSENT_SHOWN_KEY, '1');
  };

  return { showConsent, onConsentGranted, onConsentDismissed };
}
