import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  hasPushConsentAccepted,
  isAndroidPushPermissionAutoGranted,
  markPushConsentAccepted,
  migrateLegacyPushConsentState,
  shouldShowPushConsentPrompt,
  snoozePushConsentPrompt,
  storePushToken,
  supportsNativePushNotifications,
} from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

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
 * Exposes a custom consent sheet that product surfaces can trigger before
 * touching OS permissions.
 * This is required because:
 * - iOS: the OS prompt can only be shown once — we explain why first
 * - Android < 13: permissions are auto-granted, so the OS never shows a prompt
 *   at all; our sheet is the only way to inform the user
 * - Android 13+: runtime permission required, same as iOS
 *
 * If permission was already granted from a previous install, token registration
 * happens silently.
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
        await migrateLegacyPushConsentState(status);

        if (
          status === 'granted' &&
          isAndroidPushPermissionAutoGranted() &&
          !(await hasPushConsentAccepted())
        ) {
          return;
        }

        // If already explicitly denied, nothing to do — user must go to Settings
        if (status === 'denied') {
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

  const requestConsent = useCallback(async () => {
    if (!orgId || !profileId) return false;
    try {
      if (!supportsNativePushNotifications()) {
        return false;
      }

      await ensureAndroidChannel();
      const Notifications = getNotificationsModule();
      const { status } = await Notifications.getPermissionsAsync();
      await migrateLegacyPushConsentState(status);

      if (status === 'granted' && isAndroidPushPermissionAutoGranted()) {
        if (await hasPushConsentAccepted()) {
          if (!registered.current) {
            registered.current = true;
            const token = await getExpoPushToken({ requestPermissions: false });
            if (token) {
              await storePushToken(orgId, profileId, token);
            }
          }
          return false;
        }

        const shouldShowConsent = await shouldShowPushConsentPrompt();
        if (!shouldShowConsent) {
          return false;
        }

        setShowConsent(true);
        return true;
      }

      if (status === 'granted') {
        if (!registered.current) {
          registered.current = true;
          const token = await getExpoPushToken({ requestPermissions: false });
          if (token) {
            await storePushToken(orgId, profileId, token);
          }
        }
        return false;
      }

      if (status === 'denied') {
        return false;
      }

      const shouldShowConsent = await shouldShowPushConsentPrompt();
      if (!shouldShowConsent) {
        return false;
      }

      setShowConsent(true);
      return true;
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.notifications.use_push_registration.request_consent',
        message: 'Push consent request failed',
        context: { orgId, profileId },
      });
      return false;
    }
  }, [orgId, profileId]);

  const onConsentGranted = useCallback(async () => {
    setShowConsent(false);
    await markPushConsentAccepted();
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
  }, [orgId, profileId]);

  const onConsentDismissed = useCallback(async () => {
    setShowConsent(false);
    await snoozePushConsentPrompt();
  }, []);

  return { showConsent, requestConsent, onConsentGranted, onConsentDismissed };
}
