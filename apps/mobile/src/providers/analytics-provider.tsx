import React, { useContext, createContext, useMemo } from 'react';
import Constants from 'expo-constants';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import type { AnalyticsClient } from '@iconicedu/utils';
import { createNoopAnalytics } from '@iconicedu/utils';

const POSTHOG_KEY: string =
  (Constants.expoConfig?.extra?.['posthogKey'] as string | undefined) ??
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  '';

const POSTHOG_HOST: string =
  (Constants.expoConfig?.extra?.['posthogHost'] as string | undefined) ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  'https://t.iconicedu.lk';

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
    }),
    [ph],
  );

  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

/**
 * Wraps the app with PostHog + exposes vendor-agnostic AnalyticsClient via context.
 * Mount this near the top of the provider tree (before AuthProvider).
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
      options={{
        host: POSTHOG_HOST,
        // Send batched events every 30 s or when the batch reaches 20 events
        flushInterval: 30000,
        flushAt: 20,
        // Enable session replay (available in posthog-react-native ≥ 3.x)
        enableSessionReplay: true,
        sessionReplayConfig: {
          maskAllTextInputs: false,
          maskAllImages: false,
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
