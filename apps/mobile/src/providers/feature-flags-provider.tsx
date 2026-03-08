/**
 * Vendor-agnostic feature flags context for the mobile app.
 *
 * Architecture:
 *  - FlagsContext holds a plain Record<flagKey, boolean> — no PostHog types leak out.
 *  - FlagsBridge uses posthog-react-native's reactive `useFeatureFlag` hook for each
 *    declared flag. This hook re-renders automatically when flags load or change,
 *    unlike the manual isFeatureEnabled + onFeatureFlags pattern which relied on
 *    `ph` being a stable reference (it never changes) and therefore never re-ran.
 *  - useFlag(key) is the single public API for consuming flags in the app.
 *  - When PostHog is not configured or a flag hasn't loaded yet, defaultValue is used.
 *
 * Adding a new flag:
 *  1. Add the key + definition to src/lib/flags.ts
 *  2. Add one `useFeatureFlag(key)` call in FlagsBridge below
 */

import React, { createContext, useContext } from 'react';
import { useFeatureFlag } from 'posthog-react-native';
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
 * Calls posthog-react-native's reactive `useFeatureFlag` for every declared flag.
 * Each call subscribes to that flag individually and triggers a re-render when
 * the flag's value changes — no manual polling or onFeatureFlags subscription needed.
 *
 * Must be a descendant of <PostHogProvider> (guaranteed by AppProviders mounting
 * FlagsProvider inside AnalyticsProvider which wraps with PostHogProvider).
 *
 * NOTE: Add one useFeatureFlag line here whenever a new flag is added to flags.ts.
 * Hooks cannot be called in a loop, so each flag must be declared explicitly.
 */
function FlagsBridge({ children }: { children: React.ReactNode }) {
  // ── Declare one line per flag in mobileFlags ────────────────────────────────
  const enableQuickAccess = useFeatureFlag('enable-quick-access');

  const flags: FlagsState = {
    'enable-quick-access':
      typeof enableQuickAccess === 'boolean'
        ? enableQuickAccess
        : mobileFlags['enable-quick-access'].defaultValue,
  };

  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Mount this *inside* <AnalyticsProvider> so FlagsBridge has access to the
 * PostHog context. When PostHog is not configured (no API key), AnalyticsProvider
 * renders children without PostHogProvider — in that case useFeatureFlag returns
 * undefined and every flag falls back to its defaultValue.
 */
export function FlagsProvider({ children }: { children: React.ReactNode }) {
  return <FlagsBridge>{children}</FlagsBridge>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current boolean value for the given feature flag.
 * Re-renders automatically when the flag changes (backed by PostHog's reactive hook).
 * Falls back to the flag's defaultValue while loading or when the SDK is absent.
 *
 * @example
 * const showQuickAccess = useFlag('enable-quick-access');
 */
export function useFlag(key: MobileFlagKey): boolean {
  return useContext(FlagsContext)[key];
}
