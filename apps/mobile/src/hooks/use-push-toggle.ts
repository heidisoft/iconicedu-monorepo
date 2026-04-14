import { useState, useEffect, useCallback } from 'react';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  storePushToken,
  revokePushToken,
  getStoredPushToken,
} from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useNotificationPrefs } from './use-notification-prefs';
import { useProfile } from './use-profile';
import { useUpdateNotificationPref } from './use-update-notification-pref';

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go / tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

const PUSH_PREF_KEY = '__push__';

export type UsePushToggleResult = {
  /** true when OS permission is granted AND the __push__ preference is not muted */
  isPushEnabled: boolean;
  /** true when the OS has permanently denied push notification permission */
  isOsPermissionDenied: boolean;
  /** true while the async toggle operation is in flight (debounces rapid taps) */
  isToggling: boolean;
  toggle: () => Promise<void>;
};

/**
 * Manages the master push notification toggle.
 *
 * Turning OFF: revokes the push token in the DB so the server stops delivering
 * pushes, and sets the __push__ preference to muted.
 *
 * Turning ON: re-registers the push token (re-sets revoked_at to null) and
 * un-mutes the __push__ preference.
 *
 * OS permission denial is surfaced via `isOsPermissionDenied` so the caller
 * can show a "open system Settings" affordance instead of the normal toggle.
 */
export function usePushToggle(): UsePushToggleResult {
  const [osPermission, setOsPermission] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const [isToggling, setIsToggling] = useState(false);

  const { data: prefs = [] } = useNotificationPrefs();
  const { mutateAsync: updatePref } = useUpdateNotificationPref();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  // Check OS permission once on mount.
  useEffect(() => {
    void getNotificationsModule()
      .getPermissionsAsync()
      .then(({ status }) => {
        setOsPermission(status);
      });
  }, []);

  const pushPref = (prefs as Record<string, unknown>[]).find(
    (p) => (p as { pref_key: string }).pref_key === PUSH_PREF_KEY,
  );
  const isPushMuted = (pushPref as { muted?: boolean } | undefined)?.muted ?? false;

  const isOsPermissionDenied = osPermission === 'denied';
  const isPushEnabled = osPermission === 'granted' && !isPushMuted;

  const toggle = useCallback(async () => {
    if (isToggling) return;
    if (isOsPermissionDenied) return;

    setIsToggling(true);
    try {
      if (isPushEnabled) {
        // --- TURNING OFF ---
        const token = await getStoredPushToken();
        if (token) {
          await revokePushToken(token);
        }
        await updatePref({ prefKey: PUSH_PREF_KEY, muted: true });
      } else {
        // --- TURNING ON ---
        // requestPermissions: false — the initial OS prompt is usePushRegistration's job.
        // Here we only re-register if OS already granted; otherwise just update the pref.
        const token = await getExpoPushToken({ requestPermissions: false });
        if (token && orgId && profileId) {
          // storePushToken sets revoked_at: null and persists to SecureStore
          await storePushToken(orgId, profileId, token);
        }
        await updatePref({ prefKey: PUSH_PREF_KEY, muted: false });
      }
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.notifications.use_push_toggle',
        message: isPushEnabled
          ? 'Failed to disable push notifications'
          : 'Failed to enable push notifications',
      });
    } finally {
      setIsToggling(false);
    }
  }, [isToggling, isOsPermissionDenied, isPushEnabled, orgId, profileId, updatePref]);

  return { isPushEnabled, isOsPermissionDenied, isToggling, toggle };
}
