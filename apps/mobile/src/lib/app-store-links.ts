import { Platform } from 'react-native';
import type { MobileMinAppVersionPayload } from '@iconicedu/shared-types';

import { ICONIC_IOS_STORE_URL, ICONIC_ANDROID_STORE_URL } from '@iconicedu/utils';

/** Resolves the store link to open for the running platform, preferring an explicit payload override. */
export function getAppStoreUrl(payload: MobileMinAppVersionPayload | null): string {
  if (Platform.OS === 'android') {
    return payload?.androidUrl?.trim() || ICONIC_ANDROID_STORE_URL;
  }
  return payload?.iosUrl?.trim() || ICONIC_IOS_STORE_URL;
}
