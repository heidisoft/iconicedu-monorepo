/**
 * Payload shape for the `mobile-min-app-version` PostHog feature flag
 * (see platformFeatureFlagKeys.mobileMinAppVersion). Editable from the
 * PostHog dashboard without a new app build — the mobile app compares its
 * own version against the field matching the running platform and shows a
 * dismissible "update available" banner when it falls behind.
 */
export type MobileMinAppVersionPayload = {
  /** Minimum required version for iOS, e.g. "1.3.0". Omit to never nudge iOS users. */
  ios?: string;
  /** Minimum required version for Android, e.g. "1.3.0". Omit to never nudge Android users. */
  android?: string;
  /** Custom banner copy. Falls back to a generic "update available" message. */
  message?: string;
  /** Store link override for iOS. Defaults to an App Store search if omitted. */
  iosUrl?: string;
  /** Store link override for Android. Defaults to the Play Store listing if omitted. */
  androidUrl?: string;
};
