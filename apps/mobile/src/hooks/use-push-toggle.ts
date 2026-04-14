import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  storePushToken,
  revokePushToken,
  getStoredPushToken,
} from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go / tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

export type UsePushToggleResult = {
  /** true when the device currently grants push notification permission */
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
 * pushes.
 *
 * Turning ON: re-registers the push token (re-sets revoked_at to null).
 *
 * OS permission denial is surfaced via `isOsPermissionDenied` so the caller
 * can show a "open system Settings" affordance instead of the normal toggle.
 */
export function usePushToggle(): UsePushToggleResult {
  const [osPermission, setOsPermission] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const [isToggling, setIsToggling] = useState(false);

  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  const refreshPermission = useCallback(async () => {
    const { status } = await getNotificationsModule().getPermissionsAsync();
    setOsPermission(status);
  }, []);

  // Refresh on mount and when returning from system settings.
  useEffect(() => {
    void refreshPermission();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void refreshPermission();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [refreshPermission]);

  const isOsPermissionDenied = osPermission === 'denied';
  const isPushEnabled = osPermission === 'granted';

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
      } else {
        // --- TURNING ON ---
        // requestPermissions: false — the initial OS prompt is usePushRegistration's job.
        // Here we only re-register if OS already granted.
        const token = await getExpoPushToken({ requestPermissions: false });
        if (token && orgId && profileId) {
          // storePushToken sets revoked_at: null and persists to SecureStore
          await storePushToken(orgId, profileId, token);
        }
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
      void refreshPermission();
      setIsToggling(false);
    }
  }, [
    isToggling,
    isOsPermissionDenied,
    isPushEnabled,
    orgId,
    profileId,
    refreshPermission,
  ]);

  return { isPushEnabled, isOsPermissionDenied, isToggling, toggle };
}
