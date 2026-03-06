'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

import { resolvePostHogBrowserConfig } from '@iconicedu/web/lib/analytics/posthog-config';
import {
  POSTHOG_EVENT_KEYS,
  buildPostHogPageViewProperties,
} from '@iconicedu/web/lib/analytics/posthog-events';

// Resolved once at module load — env vars are static, no need to re-read.
const browserConfig = resolvePostHogBrowserConfig();

// PostHog is initialized here rather than in instrumentation-client.ts because
// Next.js requires experimental.clientInstrumentationHook: true to run that file,
// and without the flag it is silently skipped. A useEffect in a client component
// is unconditional and works in all Next.js versions.
// Error capture ($exception) and web vitals ($web_vitals) are handled natively
// via capture_exceptions: true and capture_performance: true.
export function PostHogAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasCapturedAppLoadedRef = useRef(false);
  const lastPageViewRef = useRef<string | null>(null);
  const search = searchParams.toString();
  const origin = typeof window !== 'undefined' ? window.location.origin : null;

  const pageViewProperties = useMemo(
    () => buildPostHogPageViewProperties({ pathname, search, origin }),
    [origin, pathname, search],
  );

  // Run once on mount — posthog.init() is idempotent if called again.
  useEffect(() => {
    if (!browserConfig) return;

    posthog.init(browserConfig.apiKey, {
      // Route through Next.js rewrites (/ingest → us.i.posthog.com) so
      // ad blockers that target the posthog.com domain cannot drop events.
      api_host: '/ingest',
      ui_host: browserConfig.apiHost,
      defaults: browserConfig.defaults,
      person_profiles: 'always',
      autocapture: true,
      capture_pageview: false, // captured manually below (SPA-safe deduplication)
      capture_pageleave: true,
      capture_exceptions: true,
      capture_performance: true,
      persistence: 'localStorage+cookie',
      enable_recording_console_log: true,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true },
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          ph.debug();
        }
      },
    });
  }, []);

  useEffect(() => {
    if (!browserConfig || hasCapturedAppLoadedRef.current) return;
    posthog.capture(POSTHOG_EVENT_KEYS.appLoaded, { pathname });
    hasCapturedAppLoadedRef.current = true;
  }, [pathname]);

  useEffect(() => {
    if (!browserConfig || !pageViewProperties.$current_url) return;
    if (lastPageViewRef.current === pageViewProperties.$current_url) return;
    posthog.capture('$pageview', pageViewProperties);
    lastPageViewRef.current = pageViewProperties.$current_url;
  }, [pageViewProperties]);

  return null;
}
