import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAnalytics } from '@/providers/analytics-provider';
import { AnalyticsEvent } from '@iconicedu/utils';

/**
 * Listens for React Native AppState changes and fires analytics events for
 * foreground/background transitions. Mount once in the root layout.
 * Renders nothing.
 */
export function AppLifecycleTracker() {
  const analytics = useAnalytics();
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = previousState.current;
      previousState.current = nextState;

      if (nextState === 'active' && prev !== 'active') {
        analytics.capture(AnalyticsEvent.APP_FOREGROUNDED);
      } else if (nextState === 'background' || nextState === 'inactive') {
        analytics.capture(AnalyticsEvent.APP_BACKGROUNDED, { state: nextState });
      }
    });

    return () => subscription.remove();
  }, [analytics]);

  return null;
}
