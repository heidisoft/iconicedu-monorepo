'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

import { isPostHogBrowserConfigured } from '@iconicedu/web/lib/analytics/posthog-config';
import {
  POSTHOG_EVENT_KEYS,
  buildPostHogPageViewProperties,
} from '@iconicedu/web/lib/analytics/posthog-events';

// Error capture and web vitals are handled natively by PostHog via
// capture_exceptions: true and capture_performance: true in instrumentation-client.ts.
export function PostHogAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasPostHog = isPostHogBrowserConfigured();
  const hasCapturedAppLoadedRef = useRef(false);
  const lastPageViewRef = useRef<string | null>(null);
  const search = searchParams.toString();
  const origin = typeof window !== 'undefined' ? window.location.origin : null;

  const pageViewProperties = useMemo(
    () =>
      buildPostHogPageViewProperties({
        pathname,
        search,
        origin,
      }),
    [origin, pathname, search],
  );

  useEffect(() => {
    if (!hasPostHog || hasCapturedAppLoadedRef.current) {
      return;
    }

    posthog.capture(POSTHOG_EVENT_KEYS.appLoaded, {
      pathname,
    });
    hasCapturedAppLoadedRef.current = true;
  }, [hasPostHog, pathname]);

  useEffect(() => {
    if (!hasPostHog || !pageViewProperties.$current_url) {
      return;
    }

    if (lastPageViewRef.current === pageViewProperties.$current_url) {
      return;
    }

    posthog.capture('$pageview', pageViewProperties);
    lastPageViewRef.current = pageViewProperties.$current_url;
  }, [hasPostHog, pageViewProperties]);

  return null;
}
