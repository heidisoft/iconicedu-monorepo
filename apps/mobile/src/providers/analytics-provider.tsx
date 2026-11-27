import React, { useContext, createContext, useEffect, useMemo } from 'react';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { PostHog, PostHogProvider, usePostHog } from 'posthog-react-native';
import type { AnalyticsClient } from '@iconicedu/utils';
import { createNoopAnalytics, setGlobalErrorReporter } from '@iconicedu/utils';
import {
  MobileFeatureFlagsProvider,
  type MobileFeatureFlagClient,
} from './mobile-feature-flags-provider';

const POSTHOG_KEY: string =
  (Constants.expoConfig?.extra?.['posthogKey'] as string | undefined) ??
  process.env.POSTHOG_KEY ??
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  '';

const POSTHOG_HOST: string =
  (Constants.expoConfig?.extra?.['posthogHost'] as string | undefined) ??
  process.env.POSTHOG_HOST ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  'https://t.iconicedu.lk';

export function hasPostHogNativeReplayModule(
  nativeModules: Record<string, unknown>,
): boolean {
  return Boolean(
    nativeModules.PosthogReactNativePlugin ??
    nativeModules.PosthogReactNativeSessionReplay,
  );
}

// Only enable session replay when the native module is actually linked.
// Without this guard, PostHogProvider crashes in Expo Go / non-prebuild builds,
// taking ALL event capture down with it. PostHog renamed the replay package to
// @posthog/react-native-plugin in SDK 4.47+, which registers this native module.
const ENABLE_SESSION_REPLAY = hasPostHogNativeReplayModule(NativeModules);

// ─── Vendor-agnostic context ──────────────────────────────────────────────────

const AnalyticsContext = createContext<AnalyticsClient>(createNoopAnalytics());

/**
 * Bridges PostHog's hook into the vendor-agnostic AnalyticsClient context.
 * Must be mounted inside <PostHogProvider>.
 */
function AnalyticsBridge({
  children,
  flagsClient,
}: {
  children: React.ReactNode;
  flagsClient: PostHog | null;
}) {
  const ph = usePostHog();
  const featureFlagClient = (flagsClient ?? ph) as MobileFeatureFlagClient;

  const client = useMemo<AnalyticsClient>(
    () => ({
      identify(userId: string, traits?: Record<string, unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ph.identify(userId, traits as any);
        flagsClient?.identify(userId, traits as Parameters<PostHog['identify']>[1]);
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
        flagsClient?.reset();
      },
      flush() {
        ph.flush();
      },
    }),
    [ph, flagsClient],
  );

  useEffect(() => {
    setGlobalErrorReporter((event, properties) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ph.capture(event, properties as any);
    });

    return () => {
      setGlobalErrorReporter(null);
    };
  }, [ph]);

  return (
    <MobileFeatureFlagsProvider client={featureFlagClient}>
      <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>
    </MobileFeatureFlagsProvider>
  );
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
  const flagsClient = useMemo(() => {
    // This optional project is for local flags only; release builds ignore it.
    // eslint-disable-next-line no-undef
    const key = __DEV__ ? process.env.EXPO_PUBLIC_POSTHOG_FLAGS_KEY?.trim() : undefined;
    return key
      ? new PostHog(key, {
          host: process.env.EXPO_PUBLIC_POSTHOG_FLAGS_HOST?.trim() || POSTHOG_HOST,
          persistence: 'memory',
          captureAppLifecycleEvents: false,
          enableSessionReplay: false,
          errorTracking: { autocapture: false },
          before_send: () => null,
        })
      : null;
  }, []);
  useEffect(
    () => () => {
      void flagsClient?.shutdown();
    },
    [flagsClient],
  );
  if (!POSTHOG_KEY) {
    // No key configured — use noop in dev/CI to avoid crashing.
    return (
      <MobileFeatureFlagsProvider client={flagsClient}>
        <AnalyticsContext.Provider value={createNoopAnalytics()}>
          {children}
        </AnalyticsContext.Provider>
      </MobileFeatureFlagsProvider>
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
      <AnalyticsBridge flagsClient={flagsClient}>{children}</AnalyticsBridge>
    </PostHogProvider>
  );
}

/** Use anywhere in the app to fire analytics events without importing PostHog directly. */
export function useAnalytics(): AnalyticsClient {
  return useContext(AnalyticsContext);
}
