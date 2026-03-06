import { useCallback } from 'react';
import { useAnalytics } from '@/providers/analytics-provider';
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
 * Convenience hook that wraps useAnalytics() with typed helpers for common
 * UI tracking patterns. Use this in components instead of calling
 * analytics.capture(AnalyticsEvent.X, ...) directly.
 *
 * All methods are stable (useCallback) and safe to call from event handlers.
 */
export function useTrack() {
  const analytics = useAnalytics();

  // ── Navigation ────────────────────────────────────────────────────────────

  const trackScreen = useCallback(
    (screenName: string, extra?: Record<string, unknown>) => {
      analytics.screen(screenName, { screen_name: screenName, ...extra });
    },
    [analytics],
  );

  const trackTabChanged = useCallback(
    (tabName: string) => {
      analytics.capture(AnalyticsEvent.TAB_CHANGED, { tab: tabName });
    },
    [analytics],
  );

  const trackModalOpened = useCallback(
    (modalName: string) => {
      analytics.capture(AnalyticsEvent.MODAL_OPENED, { modal: modalName });
    },
    [analytics],
  );

  const trackModalClosed = useCallback(
    (modalName: string) => {
      analytics.capture(AnalyticsEvent.MODAL_CLOSED, { modal: modalName });
    },
    [analytics],
  );

  // ── Clicks ────────────────────────────────────────────────────────────────

  const trackButtonClick = useCallback(
    (props: ButtonClickedProps) => {
      analytics.capture(AnalyticsEvent.BUTTON_CLICKED, { ...props });
    },
    [analytics],
  );

  const trackLinkClick = useCallback(
    (url: string, label?: string) => {
      analytics.capture(AnalyticsEvent.LINK_CLICKED, { url, label });
    },
    [analytics],
  );

  // ── Forms ─────────────────────────────────────────────────────────────────

  const trackFormStarted = useCallback(
    (formName: string) => {
      analytics.capture(AnalyticsEvent.FORM_STARTED, { form_name: formName });
    },
    [analytics],
  );

  const trackFormStepCompleted = useCallback(
    (props: FormEventProps) => {
      analytics.capture(AnalyticsEvent.FORM_STEP_COMPLETED, { ...props });
    },
    [analytics],
  );

  const trackFormSubmitted = useCallback(
    (formName: string, extra?: Record<string, unknown>) => {
      analytics.capture(AnalyticsEvent.FORM_SUBMITTED, { form_name: formName, ...extra });
    },
    [analytics],
  );

  const trackFormAbandoned = useCallback(
    (props: FormEventProps) => {
      analytics.capture(AnalyticsEvent.FORM_ABANDONED, { ...props });
    },
    [analytics],
  );

  const trackFormValidationError = useCallback(
    (props: FormEventProps) => {
      analytics.capture(AnalyticsEvent.FORM_VALIDATION_ERROR, { ...props });
    },
    [analytics],
  );

  // ── Search ────────────────────────────────────────────────────────────────

  const trackSearch = useCallback(
    (props: SearchProps) => {
      analytics.capture(AnalyticsEvent.SEARCH_PERFORMED, { ...props });
    },
    [analytics],
  );

  const trackSearchResultClicked = useCallback(
    (props: SearchProps & { result_index?: number; result_id?: string }) => {
      analytics.capture(AnalyticsEvent.SEARCH_RESULT_CLICKED, { ...props });
    },
    [analytics],
  );

  // ── Notifications ─────────────────────────────────────────────────────────

  const trackNotificationTapped = useCallback(
    (props: NotificationEventProps) => {
      analytics.capture(AnalyticsEvent.NOTIFICATION_TAPPED, { ...props });
    },
    [analytics],
  );

  const trackNotificationDismissed = useCallback(
    (props: NotificationEventProps) => {
      analytics.capture(AnalyticsEvent.NOTIFICATION_DISMISSED, { ...props });
    },
    [analytics],
  );

  // ── Errors ────────────────────────────────────────────────────────────────

  const trackError = useCallback(
    (props: ErrorEventProps) => {
      analytics.capture(AnalyticsEvent.ERROR_SHOWN, { ...props });
    },
    [analytics],
  );

  // ── Feature Usage ─────────────────────────────────────────────────────────

  const trackFeatureUsed = useCallback(
    (featureName: string, extra?: Record<string, unknown>) => {
      analytics.capture(AnalyticsEvent.FEATURE_USED, { feature: featureName, ...extra });
    },
    [analytics],
  );

  // ── Funnels ───────────────────────────────────────────────────────────────

  const trackFunnelStep = useCallback(
    (props: FunnelProps) => {
      analytics.capture(AnalyticsEvent.FUNNEL_STEP_REACHED, { ...props });
    },
    [analytics],
  );

  const trackFunnelCompleted = useCallback(
    (funnelName: string) => {
      analytics.capture(AnalyticsEvent.FUNNEL_COMPLETED, { funnel_name: funnelName });
    },
    [analytics],
  );

  const trackFunnelAbandoned = useCallback(
    (props: FunnelProps) => {
      analytics.capture(AnalyticsEvent.FUNNEL_ABANDONED, { ...props });
    },
    [analytics],
  );

  // ── Engagement ────────────────────────────────────────────────────────────

  const trackContentShared = useCallback(
    (contentType: string, contentId?: string) => {
      analytics.capture(AnalyticsEvent.CONTENT_SHARED, {
        content_type: contentType,
        content_id: contentId,
      });
    },
    [analytics],
  );

  const trackSettingsSaved = useCallback(
    (settingsSection: string, changes?: Record<string, unknown>) => {
      analytics.capture(AnalyticsEvent.SETTINGS_SAVED, {
        section: settingsSection,
        ...changes,
      });
    },
    [analytics],
  );

  // ── Performance ───────────────────────────────────────────────────────────

  const trackSlowScreen = useCallback(
    (screenName: string, loadTimeMs: number) => {
      analytics.capture(AnalyticsEvent.SLOW_SCREEN, {
        screen_name: screenName,
        load_time_ms: loadTimeMs,
      });
    },
    [analytics],
  );

  return {
    // raw client if you need an unlisted event
    analytics,
    // navigation
    trackScreen,
    trackTabChanged,
    trackModalOpened,
    trackModalClosed,
    // clicks
    trackButtonClick,
    trackLinkClick,
    // forms
    trackFormStarted,
    trackFormStepCompleted,
    trackFormSubmitted,
    trackFormAbandoned,
    trackFormValidationError,
    // search
    trackSearch,
    trackSearchResultClicked,
    // notifications
    trackNotificationTapped,
    trackNotificationDismissed,
    // errors
    trackError,
    // feature usage
    trackFeatureUsed,
    // funnels
    trackFunnelStep,
    trackFunnelCompleted,
    trackFunnelAbandoned,
    // engagement
    trackContentShared,
    trackSettingsSaved,
    // performance
    trackSlowScreen,
  };
}
