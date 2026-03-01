import posthog from 'posthog-js';

import { resolvePostHogBrowserConfig } from './lib/analytics/posthog-browser-config';

const config = resolvePostHogBrowserConfig();

if (config && typeof window !== 'undefined') {
  posthog.init(config.apiKey, {
    api_host: config.apiHost,
    defaults: config.defaults,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
}
