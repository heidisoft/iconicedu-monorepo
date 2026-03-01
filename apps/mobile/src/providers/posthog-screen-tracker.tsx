import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { posthogClient } from '@/providers/posthog-provider';

/**
 * Fires a screen view event on every Expo Router pathname change.
 * Uses the module singleton — safe anywhere in the tree.
 */
export function PostHogScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && posthogClient) {
      posthogClient.screen(pathname);
    }
  }, [pathname]);

  return null;
}
