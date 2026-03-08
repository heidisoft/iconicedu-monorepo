/**
 * Vendor-agnostic feature flags context for the mobile app.
 *
 * Architecture mirrors analytics-provider.tsx:
 *  - FlagsContext holds a plain Record<flagKey, boolean> — no PostHog types leak out.
 *  - FlagsBridge (mounted inside PostHogProvider) reads all declared flags via
 *    usePostHog() and pushes the resolved values into context.
 *  - useFlag(key) is the single public API for consuming flags.
 *  - When PostHog is not configured (no API key) or a flag hasn't loaded,
 *    the flag's defaultValue from the catalog is used.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';
import { mobileFlags, type MobileFlagKey } from '@/lib/flags';

// ─── Context ─────────────────────────────────────────────────────────────────

type FlagsState = Record<MobileFlagKey, boolean>;

function buildDefaults(): FlagsState {
  return Object.fromEntries(
    Object.values(mobileFlags).map((f) => [f.key, f.defaultValue]),
  ) as FlagsState;
}

const FlagsContext = createContext<FlagsState>(buildDefaults());

// ─── Bridge (mounted inside PostHogProvider) ──────────────────────────────────

/**
 * Reads every declared flag from the live PostHog client and exposes the
 * resolved values through FlagsContext. Falls back to defaultValue for any
 * flag that hasn't loaded or is undefined.
 *
 * Must be mounted as a descendant of <PostHogProvider>.
 *
 * Root cause of the "flag set in PostHog but still false" issue:
 * `ph` is a stable object reference — it never changes identity after mount.
 * computing flags from `ph` once therefore only runs once, at mount time, when PostHog hasn't
 * fetched flags from the network yet (isFeatureEnabled returns undefined →
 * falls through to defaultValue). The fix is to subscribe to ph.onFeatureFlags,
 * which fires when flags are loaded or reloaded, and bump a version counter to
 * force the provider to re-render with the now-populated flag values.
 */
function FlagsBridge({ children }: { children: React.ReactNode }) {
  const ph = usePostHog();

  // Bumped every time PostHog signals that flags have loaded or reloaded.
  const [, setFlagsVersion] = useState(0);

  useEffect(() => {
    if (!ph) return;
    const unsubscribe = ph.onFeatureFlags(() => {
      setFlagsVersion((v) => v + 1);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [ph]);

  const flags = Object.fromEntries(
    Object.values(mobileFlags).map((def) => {
      const raw = ph?.isFeatureEnabled(def.key);
      const value = typeof raw === 'boolean' ? raw : def.defaultValue;
      return [def.key, value];
    }),
  ) as FlagsState;

  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Mount this *inside* <AnalyticsProvider> so FlagsBridge has access to the
 * PostHog context. When PostHog is not configured (AnalyticsProvider renders
 * children directly without PostHogProvider), FlagsContext keeps its default
 * values from the catalog.
 */
export function FlagsProvider({ children }: { children: React.ReactNode }) {
  return <FlagsBridge>{children}</FlagsBridge>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current boolean value for the given feature flag.
 * Falls back to the flag's defaultValue while loading or when the SDK is absent.
 *
 * @example
 * const showQuickAccess = useFlag('enable-quick-access');
 */
export function useFlag(key: MobileFlagKey): boolean {
  return useContext(FlagsContext)[key];
}
