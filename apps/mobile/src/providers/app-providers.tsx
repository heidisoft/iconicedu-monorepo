import React from 'react';
import { UiTrackingContext } from '@iconicedu/ui-native';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { AnalyticsProvider, useAnalytics } from '@/providers/analytics-provider';
import { FlagsProvider } from '@/providers/feature-flags-provider';
import { CrashBoundary } from '@/components/analytics/crash-boundary';

/**
 * Wires the vendor-agnostic UiTrackingContext so all ui-native Buttons and
 * IconButtons automatically fire analytics events without touching PostHog directly.
 * Must be mounted inside AnalyticsProvider.
 */
function UiTrackingBridge({ children }: { children: React.ReactNode }) {
  const analytics = useAnalytics();
  return (
    <UiTrackingContext.Provider value={analytics.capture}>
      {children}
    </UiTrackingContext.Provider>
  );
}

/**
 * Wraps children with CrashBoundary using the live analytics capture function.
 * Must be mounted inside AnalyticsProvider.
 */
function CrashBoundaryBridge({ children }: { children: React.ReactNode }) {
  const analytics = useAnalytics();
  return <CrashBoundary analyticsCapture={analytics.capture}>{children}</CrashBoundary>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <FlagsProvider>
          <CrashBoundaryBridge>
            <UiTrackingBridge>
              <QueryProvider>
                <AuthProvider>{children}</AuthProvider>
              </QueryProvider>
            </UiTrackingBridge>
          </CrashBoundaryBridge>
        </FlagsProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
