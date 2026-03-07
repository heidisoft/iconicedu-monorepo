import { createContext, useContext } from 'react';

/**
 * Generic capture callback injected by the host app (mobile/web).
 * Accepts an event name and optional properties — matches AnalyticsClient.capture().
 * Defaults to a no-op so ui-native components are safe without a provider.
 */
export type UiTrackCapture = (event: string, props?: Record<string, unknown>) => void;

export const UiTrackingContext = createContext<UiTrackCapture>(() => undefined);

/** Returns the capture function from the nearest UiTrackingContext.Provider. */
export function useUiTracking(): UiTrackCapture {
  return useContext(UiTrackingContext);
}
