import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useAnalytics } from '@/providers/analytics-provider';
import { AnalyticsEvent } from '@iconicedu/utils';
import { getScreenName } from '@/lib/screen-name';

/**
 * Fires analytics screen events whenever the active Expo Router route changes.
 * Mount once in the root layout — renders nothing.
 *
 * Two events per navigation:
 *  • analytics.screen(name)           — PostHog $screen event (drives funnel/path analysis)
 *  • analytics.capture(SCREEN_VIEWED) — custom event visible alongside UI events in Activity Feed
 *
 * Both carry a human-readable `screen_name` (e.g. "Schedule", not "/(app)/(tabs)/schedule")
 * and a `previous_screen` so you can build navigation funnels in PostHog.
 */
export function ScreenTracker() {
  const pathname = usePathname();
  const analytics = useAnalytics();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const screenName = getScreenName(pathname);
    const previousName = previousPathnameRef.current
      ? getScreenName(previousPathnameRef.current)
      : undefined;

    // PostHog native screen tracking ($screen event)
    analytics.screen(screenName);

    // Custom SCREEN_VIEWED event — appears in Events feed alongside button clicks,
    // making it easy to correlate "which screen was the user on before clicking X"
    analytics.capture(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: screenName,
      screen_path: pathname,
      ...(previousName ? { previous_screen: previousName } : {}),
    });

    previousPathnameRef.current = pathname;
  }, [pathname, analytics]);

  return null;
}
