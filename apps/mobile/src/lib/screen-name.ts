/**
 * Maps Expo Router raw pathnames to human-readable screen names for analytics.
 *
 * Used by both ScreenTracker (screen views) and UiTrackingBridge (UI element events)
 * so that every event in PostHog carries a consistent, readable `screen_name`.
 *
 * For unknown/dynamic routes the fallback strips route-group prefixes and
 * formats the remaining segments as "Title Case" (e.g. "/dm/abc123" → "Direct Message").
 */

// ─── Static route map ────────────────────────────────────────────────────────

const ROUTE_NAMES: Record<string, string> = {
  // Root
  '/': 'Home',

  // Auth
  '/(auth)/login': 'Login',
  '/(auth)/otp': 'OTP Verification',
  '/(auth)/profile-setup': 'Profile Setup',

  // Tabs
  '/(app)/(tabs)': 'Home',
  '/(app)/(tabs)/index': 'Home',
  '/(app)/(tabs)/schedule': 'Schedule',
  '/(app)/(tabs)/inbox': 'Notifications',
  '/(app)/(tabs)/messages': 'Messages',
  '/(app)/(tabs)/account': 'Account',

  // App — top-level pages
  '/(app)/profile': 'Profile',
  '/(app)/spaces': 'Spaces',

  // App — settings
  '/(app)/settings/family': 'Family',
  '/(app)/settings/account-info': 'Account Info',
  '/(app)/settings/notifications': 'Notifications',
  '/(app)/settings/profile': 'Profile Settings',
  '/(app)/settings/preferences': 'Preferences',
  '/(app)/settings/location': 'Location Settings',
};

// ─── Dynamic-route prefixes → readable labels ─────────────────────────────────

const DYNAMIC_PREFIXES: Array<[RegExp, string]> = [
  [/^\/(app\/)?spaces\//, 'Space'],
  [/^\/(app\/)?channel\//, 'Channel'],
  [/^\/(app\/)?dm\//, 'Direct Message'],
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a human-readable screen name for the given Expo Router pathname.
 *
 * @example
 * getScreenName('/(app)/(tabs)/schedule') // → 'Schedule'
 * getScreenName('/(app)/dm/some-id')      // → 'Direct Message'
 * getScreenName('/(app)/spaces/abc')      // → 'Space'
 */
export function getScreenName(pathname: string): string {
  // 1. Exact match
  if (ROUTE_NAMES[pathname]) return ROUTE_NAMES[pathname];

  // 2. Strip route-group segments for dynamic-prefix matching
  const stripped = pathname.replace(/\/\([^)]+\)/g, '');

  for (const [pattern, label] of DYNAMIC_PREFIXES) {
    if (pattern.test(stripped)) return label;
  }

  // 3. Generic fallback: strip groups, format segments
  const segments = stripped
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((seg) =>
      // Skip dynamic segments like [channelId]
      seg.startsWith('[')
        ? ''
        : seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .filter(Boolean);

  return segments.length > 0 ? segments.join(' > ') : 'Home';
}
