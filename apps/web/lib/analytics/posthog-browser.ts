import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://t.iconicedu.lk';

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === 'undefined' || !POSTHOG_KEY) {
    return;
  }
  initialized = true;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    person_profiles: 'identified_only',

    // Autocapture — clicks, inputs, form submits
    autocapture: true,

    // Page views (fires on every route change via PostHogPageView component)
    capture_pageview: false, // disabled here; we fire manually via PostHogPageView

    // Page-leave events for time-on-page
    capture_pageleave: true,

    // Session recording + RUM
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },

    // Web vitals (LCP, CLS, FID, INP)
    capture_performance: true,

    // Exception autocapture
    capture_exceptions: true,

    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.debug();
      }
    },
  });
}

export { posthog };
