'use client';

import { useCallback } from 'react';
import { initPostHog, posthog } from './posthog-browser';
import {
  AnalyticsEvent,
  type ButtonClickedProps,
  type FormEventProps,
  type SearchProps,
  type FunnelProps,
  type NotificationEventProps,
  type ErrorEventProps,
} from '@iconicedu/utils';

/**
 * Typed analytics helpers for web client components.
 * Wraps PostHog directly (no React context needed for web — PostHog's browser
 * singleton is initialised by PostHogPageView on mount).
 *
 * Mirrors the mobile useTrack() API so event calls are portable between platforms.
 */
export function useTrack() {
  const capture = useCallback((event: string, props?: Record<string, unknown>) => {
    initPostHog();
    // posthog-js accepts broader types; cast through unknown to satisfy strict checks
    posthog.capture(
      event,
      props as Record<string, string | number | boolean | null | undefined>,
    );
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  const trackScreen = useCallback(
    (screenName: string, extra?: Record<string, unknown>) => {
      capture('$pageview', {
        $current_url: screenName,
        screen_name: screenName,
        ...extra,
      });
    },
    [capture],
  );

  // ── Clicks ────────────────────────────────────────────────────────────────

  const trackButtonClick = useCallback(
    (props: ButtonClickedProps) => capture(AnalyticsEvent.BUTTON_CLICKED, { ...props }),
    [capture],
  );

  const trackLinkClick = useCallback(
    (url: string, label?: string) => capture(AnalyticsEvent.LINK_CLICKED, { url, label }),
    [capture],
  );

  // ── Forms ─────────────────────────────────────────────────────────────────

  const trackFormStarted = useCallback(
    (formName: string) => capture(AnalyticsEvent.FORM_STARTED, { form_name: formName }),
    [capture],
  );

  const trackFormStepCompleted = useCallback(
    (props: FormEventProps) => capture(AnalyticsEvent.FORM_STEP_COMPLETED, { ...props }),
    [capture],
  );

  const trackFormSubmitted = useCallback(
    (formName: string, extra?: Record<string, unknown>) =>
      capture(AnalyticsEvent.FORM_SUBMITTED, { form_name: formName, ...extra }),
    [capture],
  );

  const trackFormAbandoned = useCallback(
    (props: FormEventProps) => capture(AnalyticsEvent.FORM_ABANDONED, { ...props }),
    [capture],
  );

  const trackFormValidationError = useCallback(
    (props: FormEventProps) =>
      capture(AnalyticsEvent.FORM_VALIDATION_ERROR, { ...props }),
    [capture],
  );

  // ── Search ────────────────────────────────────────────────────────────────

  const trackSearch = useCallback(
    (props: SearchProps) => capture(AnalyticsEvent.SEARCH_PERFORMED, { ...props }),
    [capture],
  );

  const trackSearchResultClicked = useCallback(
    (props: SearchProps & { result_index?: number; result_id?: string }) =>
      capture(AnalyticsEvent.SEARCH_RESULT_CLICKED, { ...props }),
    [capture],
  );

  // ── Errors ────────────────────────────────────────────────────────────────

  const trackError = useCallback(
    (props: ErrorEventProps) => capture(AnalyticsEvent.ERROR_SHOWN, { ...props }),
    [capture],
  );

  // ── Feature Usage ─────────────────────────────────────────────────────────

  const trackFeatureUsed = useCallback(
    (featureName: string, extra?: Record<string, unknown>) =>
      capture(AnalyticsEvent.FEATURE_USED, { feature: featureName, ...extra }),
    [capture],
  );

  // ── Funnels ───────────────────────────────────────────────────────────────

  const trackFunnelStep = useCallback(
    (props: FunnelProps) => capture(AnalyticsEvent.FUNNEL_STEP_REACHED, { ...props }),
    [capture],
  );

  const trackFunnelCompleted = useCallback(
    (funnelName: string) =>
      capture(AnalyticsEvent.FUNNEL_COMPLETED, { funnel_name: funnelName }),
    [capture],
  );

  const trackFunnelAbandoned = useCallback(
    (props: FunnelProps) => capture(AnalyticsEvent.FUNNEL_ABANDONED, { ...props }),
    [capture],
  );

  // ── Notifications ─────────────────────────────────────────────────────────

  const trackNotificationTapped = useCallback(
    (props: NotificationEventProps) =>
      capture(AnalyticsEvent.NOTIFICATION_TAPPED, { ...props }),
    [capture],
  );

  // ── Engagement ────────────────────────────────────────────────────────────

  const trackSettingsSaved = useCallback(
    (section: string, changes?: Record<string, unknown>) =>
      capture(AnalyticsEvent.SETTINGS_SAVED, { section, ...changes }),
    [capture],
  );

  const trackContentShared = useCallback(
    (contentType: string, contentId?: string) =>
      capture(AnalyticsEvent.CONTENT_SHARED, {
        content_type: contentType,
        content_id: contentId,
      }),
    [capture],
  );

  return {
    capture,
    trackScreen,
    trackButtonClick,
    trackLinkClick,
    trackFormStarted,
    trackFormStepCompleted,
    trackFormSubmitted,
    trackFormAbandoned,
    trackFormValidationError,
    trackSearch,
    trackSearchResultClicked,
    trackError,
    trackFeatureUsed,
    trackFunnelStep,
    trackFunnelCompleted,
    trackFunnelAbandoned,
    trackNotificationTapped,
    trackSettingsSaved,
    trackContentShared,
  };
}
