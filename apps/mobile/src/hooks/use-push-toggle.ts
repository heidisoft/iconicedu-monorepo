import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  storePushToken,
  revokePushToken,
  getStoredPushToken,
} from '@/lib/notifications/push-token';
import { supabase } from '@/lib/supabase/client';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

const MASTER_PUSH_PREF_KEY = '__push__';

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
  const [isPushMuted, setIsPushMuted] = useState(false);
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

  const refreshPushMuted = useCallback(async () => {
    if (!orgId || !profileId) {
      setIsPushMuted(false);
      return;
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('muted')
      .eq('org_id', orgId)
      .eq('profile_id', profileId)
      .eq('pref_key', MASTER_PUSH_PREF_KEY)
      .is('deleted_at', null)
      .maybeSingle<{ muted: boolean | null }>();

    if (error) {
      throw new Error(error.message);
    }

    setIsPushMuted(Boolean(data?.muted));
  }, [orgId, profileId]);

  const setMasterPushMuted = useCallback(
    async (muted: boolean) => {
      if (!orgId || !profileId) return;

      const now = new Date().toISOString();
      const { error } = await supabase.from('notification_preferences').upsert(
        {
          org_id: orgId,
          profile_id: profileId,
          pref_key: MASTER_PUSH_PREF_KEY,
          channels: ['push'],
          muted,
          updated_at: now,
          updated_by: profileId,
        },
        { onConflict: 'org_id,profile_id,pref_key' },
      );

      if (error) {
        throw new Error(error.message);
      }

      setIsPushMuted(muted);
    },
    [orgId, profileId],
  );

  // Refresh on mount and when returning from system settings.
  useEffect(() => {
    void Promise.all([refreshPermission(), refreshPushMuted()]);

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void Promise.all([refreshPermission(), refreshPushMuted()]);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [refreshPermission, refreshPushMuted]);

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
        await setMasterPushMuted(true);
      } else {
        // --- TURNING ON ---
        // The user explicitly tapped the toggle, so we can recover by prompting
        // when Android permission is still undetermined.
        const requestPermissions = osPermission === 'undetermined';
        const token = await getExpoPushToken({ requestPermissions });
        const { status } = await getNotificationsModule().getPermissionsAsync();

        if (orgId && profileId) {
          if (token) {
            // storePushToken sets revoked_at: null and persists to SecureStore
            await storePushToken(orgId, profileId, token);
          }

          if (status === 'granted') {
            await setMasterPushMuted(false);
          }
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
      await Promise.all([refreshPermission(), refreshPushMuted()]);
      setIsToggling(false);
    }
  }, [
    isToggling,
    isOsPermissionDenied,
    isPushEnabled,
    osPermission,
    orgId,
    profileId,
    refreshPermission,
    refreshPushMuted,
    setMasterPushMuted,
  ]);

  return { isPushEnabled, isOsPermissionDenied, isToggling, toggle };
}
