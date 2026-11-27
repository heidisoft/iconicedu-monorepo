import type {
  AdminSessionCompletionVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';

export type CompletedSessionsTab = 'completed' | 'pending';

/**
 * Staff/admins read the org-wide admin list, which the API clamps to a rolling
 * three-month window. Stop the month picker at the current month plus the two
 * before it so an admin never lands on a month the API has only partly returned.
 */
export const ADMIN_MIN_MONTH_OFFSET = -2;

export type MonthRange = {
  /** `YYYY-MM`, used in query keys. */
  monthKey: string;
  /** Inclusive start of the month in the device's local time, as ISO. */
  start: string;
  /** Exclusive end (first instant of the next month), as ISO. */
  end: string;
  /** e.g. "November 2026". */
  label: string;
};

/**
 * Local-time month bounds `offset` months from `now` (0 = this month, -1 = last
 * month). Mirrors useCompletedSessions' currentMonthRange so month 0 reports the
 * exact same window as the home tile's count.
 */
export function monthRange(offset: number, now = new Date()): MonthRange {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return {
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    start: start.toISOString(),
    end: end.toISOString(),
    label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

/** One row on the screen, shared by the per-profile and the admin lists. */
export type CompletedSessionRow = {
  id: string;
  title: string;
  /** When the session started, so sessions crossing midnight keep their start date. */
  startsAt: string;
  sessionEndAt: string;
  /** Student name(s) shown next to the time, if known. */
  subtitle: string | null;
  statusLabel: string;
  awaitingConfirmation: boolean;
  rating: number | null;
  /** Present only for the viewer's own pending rows: rendered as the confirm tile. */
  completion: SessionCompletionVM | null;
};

function sessionTitle(title: string | null | undefined) {
  return title?.trim() || 'Session';
}

export function fromProfileCompletion(
  completion: SessionCompletionVM,
): CompletedSessionRow {
  return {
    id: completion.id,
    title: sessionTitle(completion.sessionTitle),
    startsAt: completion.occurrenceKey,
    sessionEndAt: completion.sessionEndAt,
    subtitle: completion.studentName?.trim() || null,
    statusLabel:
      completion.status === 'auto_confirmed'
        ? 'Auto-confirmed'
        : completion.status === 'pending'
          ? 'Awaiting confirmation'
          : 'Confirmed',
    awaitingConfirmation: completion.status === 'pending',
    rating: completion.rating ?? null,
    completion: completion.status === 'pending' ? completion : null,
  };
}

const ADMIN_TAB_METHODS: Record<
  CompletedSessionsTab,
  ReadonlyArray<AdminSessionCompletionVM['completionMethod']>
> = {
  // 'mixed' = some participants confirmed and others were auto-confirmed — still
  // a completed occurrence, matching how getOrgCompletionSummary counts it.
  completed: ['confirmed', 'auto_confirmed', 'mixed'],
  pending: ['pending'],
};

/**
 * Splits the admin occurrence list into one tab's rows, newest session first.
 * Disputed occurrences belong to neither tab, as they count toward neither
 * number on the home tile.
 */
export function adminRowsForTab(
  items: AdminSessionCompletionVM[],
  tab: CompletedSessionsTab,
): CompletedSessionRow[] {
  const methods = ADMIN_TAB_METHODS[tab];
  return items
    .filter((item) => methods.includes(item.completionMethod))
    .sort((a, b) => Date.parse(b.sessionEndAt) - Date.parse(a.sessionEndAt))
    .map((item) => ({
      id: item.id,
      title: sessionTitle(item.sessionTitle ?? item.learningSpaceTitle),
      startsAt: item.occurrenceKey,
      sessionEndAt: item.sessionEndAt,
      subtitle: item.studentNames.length ? item.studentNames.join(', ') : null,
      statusLabel:
        item.completionMethod === 'pending'
          ? 'Awaiting confirmation'
          : item.completionMethod === 'auto_confirmed'
            ? 'Auto-confirmed'
            : 'Confirmed',
      awaitingConfirmation: item.completionMethod === 'pending',
      rating: item.averageRating ?? null,
      completion: null,
    }));
}
