import React, { useContext, createContext, useMemo } from 'react';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import type { AnalyticsClient } from '@iconicedu/utils';
import { createNoopAnalytics } from '@iconicedu/utils';
import { getMobilePostHogEnv } from '@/lib/config/env';

const { posthogKey: POSTHOG_KEY, posthogHost: POSTHOG_HOST } = getMobilePostHogEnv({
  expoExtra:
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ?? undefined,
});

// Only enable session replay when the native module is actually linked.
// Without this guard, PostHogProvider crashes in Expo Go / non-prebuild builds,
// taking ALL event capture down with it.
const ENABLE_SESSION_REPLAY = !!NativeModules.PosthogReactNativeSessionReplay;

// ─── Vendor-agnostic context ──────────────────────────────────────────────────

const AnalyticsContext = createContext<AnalyticsClient>(createNoopAnalytics());

/**
 * Bridges PostHog's hook into the vendor-agnostic AnalyticsClient context.
 * Must be mounted inside <PostHogProvider>.
 */
function AnalyticsBridge({ children }: { children: React.ReactNode }) {
  const ph = usePostHog();

  const client = useMemo<AnalyticsClient>(
    () => ({
      identify(userId: string, traits?: Record<string, unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ph.identify(userId, traits as any);
      },
      capture(event: string, properties?: Record<string, unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ph.capture(event, properties as any);
      },
      screen(name: string, properties?: Record<string, unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ph.screen(name, properties as any);
      },
      reset() {
        ph.reset();
      },
      flush() {
        ph.flush();
      },
    }),
    [ph],
  );

  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

/**
 * Wraps the app with PostHog + exposes vendor-agnostic AnalyticsClient via context.
 * Mount this near the top of the provider tree (before AuthProvider).
 *
 * Session replay is gated on the native module being linked — degrades gracefully
 * in Expo Go or when the app has not been prebuilt yet.
 *
 * In development: debug logging enabled + events flush every 3 s so they appear
 * in the PostHog Activity Feed immediately without waiting for the 30 s batch.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    // No key configured — use noop in dev/CI to avoid crashing.
    return (
      <AnalyticsContext.Provider value={createNoopAnalytics()}>
        {children}
      </AnalyticsContext.Provider>
    );
  }

  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      // eslint-disable-next-line no-undef
      debug={__DEV__}
      options={{
        host: POSTHOG_HOST,
        // Dev: flush every 3 s / 5 events → visible in PostHog Activity Feed immediately.
        // Prod: flush every 30 s / 20 events → efficient batching.
        // eslint-disable-next-line no-undef
        flushInterval: __DEV__ ? 3000 : 30000,
        // eslint-disable-next-line no-undef
        flushAt: __DEV__ ? 5 : 20,
        // Fire Application Opened / Installed / Updated lifecycle events from JS layer
        captureAppLifecycleEvents: true,
        // Session replay: only when native module is linked (requires prebuild + native build)
        enableSessionReplay: ENABLE_SESSION_REPLAY,
        sessionReplayConfig: ENABLE_SESSION_REPLAY
          ? {
              maskAllTextInputs: false,
              maskAllImages: false,
              captureNetworkTelemetry: true,
              throttleDelayMs: 500,
            }
          : undefined,
        // Automatically capture unhandled exceptions and promise rejections
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
          },
        },
      }}
    >
      <AnalyticsBridge>{children}</AnalyticsBridge>
    </PostHogProvider>
  );
}

/** Use anywhere in the app to fire analytics events without importing PostHog directly. */
export function useAnalytics(): AnalyticsClient {
  return useContext(AnalyticsContext);
}
