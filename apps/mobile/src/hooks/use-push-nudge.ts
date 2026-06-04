import { useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  getExpoPushToken,
  storePushToken,
  supportsNativePushNotifications,
  openNotificationSettings,
} from '@/lib/notifications/push-token';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

const NUDGE_LAST_SHOWN_KEY = 'push_nudge_last_shown_at';
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go / tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

export type NudgeVariant = 'request-permission' | 'open-settings';

export type UsePushNudgeResult = {
  isVisible: boolean;
  nudgeVariant: NudgeVariant;
  triggerNudge: () => Promise<void>;
  handleEnable: () => Promise<void>;
  handleOpenSettings: () => Promise<void>;
  handleDismiss: () => void;
};

/**
 * Contextual nudge for users who have skipped or denied push notifications.
 *
 * Shows at most once per 24 hours. Two variants:
 *   - 'request-permission': OS permission is undetermined — we can still prompt.
 *   - 'open-settings': OS permanently denied — must redirect to system Settings.
 *
 * Intentionally does not use usePushToggle to avoid the extra
 * /notification-preferences API call; OS permission status is sufficient here.
 */
export function usePushNudge(): UsePushNudgeResult {
  const [isVisible, setIsVisible] = useState(false);
  const [nudgeVariant, setNudgeVariant] = useState<NudgeVariant>('request-permission');

  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  const triggerNudge = useCallback(async () => {
    if (!orgId || !profileId) return;
    if (!supportsNativePushNotifications()) return;

    const Notifications = getNotificationsModule();
    const { status } = await Notifications.getPermissionsAsync();

    // Only nudge when the OS has permanently denied permission.
    // 'undetermined' is handled by PushPermissionSheet (which can still prompt the OS).
    if (status !== 'denied') return;

    const variant: NudgeVariant = 'open-settings';

    try {
      const lastShownStr = await SecureStore.getItemAsync(NUDGE_LAST_SHOWN_KEY);
      if (lastShownStr) {
        const elapsed = Date.now() - parseInt(lastShownStr, 10);
        if (elapsed < NUDGE_COOLDOWN_MS) return;
      }
    } catch {
      // If SecureStore read fails, show the nudge anyway.
    }

    setNudgeVariant(variant);
    setIsVisible(true);
  }, [orgId, profileId]);

  const handleEnable = useCallback(async () => {
    setIsVisible(false);
    // Write timestamp eagerly so a rapid re-navigation doesn't re-trigger.
    try {
      await SecureStore.setItemAsync(NUDGE_LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      // Non-fatal.
    }

    if (!orgId || !profileId) return;

    try {
      const token = await getExpoPushToken();
      if (token) {
        await storePushToken(orgId, profileId, token);
      }
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.notifications.use_push_nudge.handle_enable',
        message: 'Failed to enable push notifications from nudge',
        context: { orgId, profileId },
      });
    }
  }, [orgId, profileId]);

  const handleOpenSettings = useCallback(async () => {
    setIsVisible(false);
    try {
      await SecureStore.setItemAsync(NUDGE_LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      // Non-fatal.
    }
    try {
      await openNotificationSettings();
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.notifications.use_push_nudge.handle_open_settings',
        message: 'Failed to open notification settings',
      });
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    void SecureStore.setItemAsync(NUDGE_LAST_SHOWN_KEY, String(Date.now())).catch(() => {
      // Non-fatal.
    });
  }, []);

  return {
    isVisible,
    nudgeVariant,
    triggerNudge,
    handleEnable,
    handleOpenSettings,
    handleDismiss,
  };
}
