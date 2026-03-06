'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, posthog } from '../lib/analytics/posthog-browser';
import type { AnalyticsClient } from '@iconicedu/utils';

// Initialise once on mount, then track every navigation.
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const url = searchParams?.size ? `${pathname}?${searchParams.toString()}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Vendor-agnostic AnalyticsClient backed by PostHog.
 * Pass this to any component that needs to fire analytics events.
 */
export function createWebAnalyticsClient(): AnalyticsClient {
  initPostHog();
  return {
    identify(userId, traits) {
      posthog.identify(userId, traits);
    },
    capture(event, properties) {
      posthog.capture(event, properties);
    },
    screen(name, properties) {
      posthog.capture('$pageview', { $current_url: name, ...properties });
    },
    reset() {
      posthog.reset();
    },
  };
}

/**
 * Identifies the signed-in user in PostHog.
 * Call this from any client component that has the user id.
 */
export function usePostHogIdentify() {
  return useCallback((userId: string, traits?: Record<string, unknown>) => {
    initPostHog();
    posthog.identify(userId, traits);
  }, []);
}
