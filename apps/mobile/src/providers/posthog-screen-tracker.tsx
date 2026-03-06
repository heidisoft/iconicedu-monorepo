import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

/**
 * Fires a screen view event on every Expo Router pathname change.
 * Uses the PostHog context hook so it stays decoupled from the singleton.
 */
export function PostHogScreenTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && posthog) {
      posthog.screen(pathname);
    }
  }, [pathname, posthog]);

  return null;
}
