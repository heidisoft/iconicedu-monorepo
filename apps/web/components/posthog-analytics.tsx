'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import posthog from 'posthog-js';

import { isPostHogBrowserConfigured } from '@iconicedu/web/lib/analytics/posthog-browser-config';
import {
  POSTHOG_EVENT_KEYS,
  buildPostHogPageViewProperties,
  buildPostHogWebVitalProperties,
} from '@iconicedu/web/lib/analytics/posthog-events';

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

  useEffect(() => {
    if (!hasPostHog) {
      return;
    }

    function handleError(event: ErrorEvent) {
      posthog.capture(POSTHOG_EVENT_KEYS.clientException, {
        kind: 'error',
        message: event.message,
        filename: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      posthog.capture(POSTHOG_EVENT_KEYS.clientException, {
        kind: 'unhandledrejection',
        reason:
          typeof event.reason === 'string'
            ? event.reason
            : event.reason instanceof Error
              ? event.reason.message
              : 'unknown',
      });
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [hasPostHog]);

  useReportWebVitals((metric) => {
    if (!hasPostHog) {
      return;
    }

    posthog.capture(POSTHOG_EVENT_KEYS.webVital, buildPostHogWebVitalProperties(metric));
  });

  return null;
}
