import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useAnalytics } from '@/providers/analytics-provider';

/**
 * Fires an analytics screen event whenever the active Expo Router route changes.
 * Equivalent of web's PostHogPageView — mount once in the root layout.
 * Renders nothing.
 */
export function ScreenTracker() {
  const pathname = usePathname();
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.screen(pathname);
  }, [pathname, analytics]);

  return null;
}
