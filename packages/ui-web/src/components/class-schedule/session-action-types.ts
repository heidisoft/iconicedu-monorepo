export type CancelSessionActionInput = {
  reason?: string | null;
};

/** `'occurrence'` (default) moves just this one occurrence — today's behavior.
 * `'thisAndFollowing'` splits the series: this occurrence and every later one
 * move to a new day/time, history before it is untouched. `'all'` rewrites the
 * whole series' day/time in place. Both series-wide scopes derive the new
 * weekday from `date` and are only offered for a simple weekly, single-weekday
 * recurrence. */
export type EditSessionScope = 'occurrence' | 'thisAndFollowing' | 'all';

export type EditSessionActionInput = {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
  scope?: EditSessionScope;
  /** `scope: 'all'` only — set after the caller has been warned that a
   * weekday change will drop future per-occurrence overrides/cancellations
   * that no longer apply, and confirmed they want to proceed anyway. */
  confirmDropFutureOverrides?: boolean;
};

/** Returned instead of completing the edit when `scope: 'all'` would drop
 * existing future overrides/cancellations — the caller should show the counts
 * and let the user resubmit with `confirmDropFutureOverrides: true`. */
export type EditSessionOutcome = {
  requiresConfirmation: true;
  futureOverrideCount: number;
  futureExceptionCount: number;
};
