import { Platform } from 'react-native';
import type { MobileMinAppVersionPayload } from '@iconicedu/shared-types';

const ANDROID_PACKAGE_NAME = 'com.heidisoft.iconicedu';

// No numeric Apple App Store ID is committed anywhere in this repo (see
// app.json/eas.json — `appVersionSource: "remote"` means EAS tracks build
// numbers itself, and no ascAppId is configured). This search-results page is
// a placeholder until the real listing exists — set `iosUrl` in the
// mobile-min-app-version flag payload for a direct link once it does.
const IOS_FALLBACK_URL = 'https://apps.apple.com/search?term=ICONIC%20Academy';
const ANDROID_FALLBACK_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

/** Resolves the store link to open for the running platform, preferring an explicit payload override. */
export function getAppStoreUrl(payload: MobileMinAppVersionPayload | null): string {
  if (Platform.OS === 'android') {
    return payload?.androidUrl?.trim() || ANDROID_FALLBACK_URL;
  }
  return payload?.iosUrl?.trim() || IOS_FALLBACK_URL;
}
