import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase/client';

/**
 * Requests push notification permissions and returns an Expo push token.
 * Returns null if the device is a simulator, permissions are denied, or token fetch fails.
 */
export async function getExpoPushToken(options?: {
  requestPermissions?: boolean;
}): Promise<string | null> {
  const requestPermissions = options?.requestPermissions ?? true;

  // Expo push tokens only work on physical devices
  if (!Constants.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!requestPermissions) {
      return null;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return tokenData.data;
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
  const now = new Date().toISOString();

  const { error } = await supabase.from('push_tokens').upsert(
    {
      org_id: orgId,
      profile_id: profileId,
      token,
      platform,
      revoked_at: null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'token' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Marks the token as revoked in the database, e.g. on logout.
 */
export async function revokePushToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token);

  if (error) {
    throw new Error(error.message);
  }
}
