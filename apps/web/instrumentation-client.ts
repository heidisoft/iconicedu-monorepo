import posthog from 'posthog-js';

import { resolvePostHogBrowserConfig } from './lib/analytics/posthog-browser-config';

const config = resolvePostHogBrowserConfig();

if (config && typeof window !== 'undefined') {
  posthog.init(config.apiKey, {
    // Route via Next.js rewrites → bypasses ad blockers that block posthog.com directly.
    // ui_host keeps PostHog's own dashboard links pointing at the real host.
    api_host: '/ingest',
    ui_host: config.apiHost,
    defaults: config.defaults,
    // Person profiles for pre-auth and post-auth funnel tracking
    person_profiles: 'always',
    // Autocapture: clicks, inputs, form submits, rage clicks, dead clicks
    autocapture: true,
    // Pageview handled manually in PostHogAnalytics (SPA-safe deduplication)
    capture_pageview: false,
    capture_pageleave: true,
    // Native exception capture → $exception events (PostHog Errors dashboard)
    capture_exceptions: true,
    // Native web vitals → $web_vitals events (PostHog Performance dashboard)
    capture_performance: true,
    persistence: 'localStorage+cookie',
    // Record console logs alongside session replays for easier debugging
    enable_recording_console_log: true,
    session_recording: {
      // Mask passwords; leave other inputs visible for support/debugging
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    loaded: (ph) => {
      // Verbose event logging in dev to confirm PostHog is working
      if (process.env.NODE_ENV === 'development') {
        ph.debug();
      }
    },
  });
}
