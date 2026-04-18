import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { apiPost } from '@/lib/api/http-client';

export const PUSH_TOKEN_STORE_KEY = 'expo_push_token';

/**
 * Returns the Expo push token stored on this device, or null if none.
 * Used by usePushToggle to revoke the token when the user disables push notifications.
 */
export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_STORE_KEY);
}

const IS_DEV =
  typeof globalThis !== 'undefined' &&
  '__DEV__' in globalThis &&
  Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
const PUSH_DEBUG_ENABLED = IS_DEV || process.env.EXPO_PUBLIC_APP_ENV === 'preview';

function logPushDebug(event: string, context?: Record<string, unknown>) {
  if (!PUSH_DEBUG_ENABLED) return;
  // eslint-disable-next-line no-console
  console.info(`[push-token] ${event}`, context ?? {});
}

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

export function supportsNativePushNotifications() {
  if (Platform.OS === 'web') {
    return false;
  }

  // Expo Go cannot receive remote push notifications, but dev clients,
  // bare apps, and standalone builds can.
  if (Constants.appOwnership === 'expo') {
    return false;
  }

  // Some SDK 55 bare/dev runtimes report this as undefined. Treat that as
  // "unknown" instead of unsupported so registration can proceed.
  if (Constants.isDevice === false) {
    return false;
  }

  return true;
}

/**
 * Requests push notification permissions and returns an Expo push token.
 * Returns null if the device is a simulator, permissions are denied, or token fetch fails.
 */
export async function getExpoPushToken(options?: {
  requestPermissions?: boolean;
}): Promise<string | null> {
  const requestPermissions = options?.requestPermissions ?? true;
  logPushDebug('start', {
    requestPermissions,
    appOwnership: Constants.appOwnership ?? null,
    executionEnvironment: Constants.executionEnvironment ?? null,
    isDevice: Constants.isDevice,
  });

  if (!supportsNativePushNotifications()) {
    logPushDebug('skip_unsupported_environment');
    return null;
  }

  const Notifications = getNotificationsModule();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  logPushDebug('permissions_existing', { status: existingStatus });
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!requestPermissions) {
      logPushDebug('skip_permission_request', { status: existingStatus });
      return null;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    logPushDebug('permissions_requested', { status });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    logPushDebug('skip_permissions_not_granted', { status: finalStatus });
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  logPushDebug('project_id_resolved', { projectId: projectId ?? null });

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    logPushDebug('token_received', {
      tokenPreview: tokenData.data ? tokenData.data.slice(0, 24) : null,
    });
    return tokenData.data;
  } catch (error) {
    reportMobileObservedError({
      error,
      source: 'mobile.notifications.get_expo_push_token',
      message: 'Failed to fetch Expo push token',
      context: {
        projectId: projectId ?? null,
        appOwnership: Constants.appOwnership ?? null,
        executionEnvironment: Constants.executionEnvironment ?? null,
        isDevice: Constants.isDevice,
      },
    });
    return null;
  }
}

/**
 * Upserts the given Expo push token into the push_tokens table for the profile.
 * On conflict (same token), updates updated_at to refresh the record.
 */
export async function storePushToken(
  orgId: string,
  profileId: string,
  token: string,
): Promise<void> {
  const platform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  try {
    await apiPost('/push-tokens/register', {
      orgId,
      profileId,
      token,
      platform,
    });
  } catch (error) {
    reportMobileObservedError({
      error,
      source: 'mobile.notifications.store_push_token',
      message: 'Failed to persist Expo push token',
      context: {
        orgId,
        profileId,
        platform,
        tokenPreview: token.slice(0, 24),
      },
    });
    throw error;
  }

  logPushDebug('token_stored', {
    orgId,
    profileId,
    platform,
    tokenPreview: token.slice(0, 24),
  });

  await SecureStore.setItemAsync(PUSH_TOKEN_STORE_KEY, token);
}

/**
 * Marks the token as revoked in the database, e.g. on logout.
 */
export async function revokePushToken(token: string): Promise<void> {
  await apiPost('/push-tokens/revoke', { token });
}
