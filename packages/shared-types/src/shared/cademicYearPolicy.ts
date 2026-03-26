/**
 * academicYearPolicy.ts
 *
 * Production-friendly academic year + cutoff policies by region.
 *
 * ⚠️ Reality check:
 * - Exact school-year start/end dates and age cutoffs vary by state, district, and school.
 * - This file provides sane DEFAULTS so you can:
 *   1) suggest grade from DOB (optional),
 *   2) label academic years consistently,
 *   3) run “rollover proposal” jobs safely.
 *
 * Recommended production pattern:
 * - Store an OrgAcademicPolicy override in DB per org (start month/day, rollover window, cutoff).
 * - Fall back to these defaults when org has no override.
 */

export type CountryOrRegion = 'us_ny' | 'uk' | 'sri_lanka' | 'australia';

export type AcademicYearKey = `${number}-${number}`; // e.g. "2025-2026"

export type MonthDay = Readonly<{ month: number; day: number }>; // month 1-12

export type RolloverWindow = Readonly<{
  /**
   * Days before the academic year end when you start proposing next-year enrollment.
   * Example: 60 => start proposing ~2 months before end.
   */
  proposeBeforeEndDays: number;

  /**
   * Days after the academic year start during which you still allow “late confirm / adjust”.
   * Example: 45 => grace period for families joining late.
   */
  confirmAfterStartDays: number;
}>;

export type GradeSuggestionPolicy = Readonly<{
  /**
   * Cutoff date used in age-based grade suggestions.
   * Example (common in many US places): Sept 1.
   * Interpretation: child must have turned 5 on or before this date to be eligible for Kindergarten.
   */
  kindergartenCutoff?: MonthDay;

  /**
   * The "reference age" for Kindergarten (usually 5).
   * (Some systems treat Foundation/Prep similarly.)
   */
  kindergartenReferenceAge?: number;

  /**
   * If true, we allow approximate age-based suggestion when DOB exists.
   * You should STILL ask for confirmation in UI.
   */
  enableAgeBasedSuggestion: boolean;
}>;

export type AcademicYearPolicy = Readonly<{
  id: CountryOrRegion;
  displayName: string;
  timezone: string; // IANA timezone

  /**
   * School year start and end (defaults).
   * Many places: late Aug/Sep start, May/Jun/Dec end (varies).
   */
  yearStart: MonthDay;
  yearEnd: MonthDay;

  /**
   * Rollover workflow timing.
   * Used to drive cron jobs + UI banners ("Confirm next year's grade").
   */
  rollover: RolloverWindow;

  /**
   * Optional age-based grade suggestion policy.
   */
  gradeSuggestion: GradeSuggestionPolicy;

  /**
   * Notes for developers/admin UX.
   */
  notes?: string;
}>;

export const ACADEMIC_YEAR_POLICIES: Readonly<
  Record<CountryOrRegion, AcademicYearPolicy>
> = Object.freeze({
  /**
   * US / New York (DEFAULTS)
   * - Many NY public schools start early September and end late June.
   * - Kindergarten cutoff dates can vary by district; a common default used elsewhere is Sept 1.
   *   Treat this as “suggestion only”, always confirm with parent/school.
   */
  us_ny: {
    id: 'us_ny',
    displayName: 'United States (New York)',
    timezone: 'America/New_York',
    yearStart: { month: 9, day: 1 },
    yearEnd: { month: 6, day: 30 },
    rollover: {
      proposeBeforeEndDays: 60,
      confirmAfterStartDays: 45,
    },
    gradeSuggestion: {
      enableAgeBasedSuggestion: true,
      kindergartenCutoff: { month: 9, day: 1 },
      kindergartenReferenceAge: 5,
    },
    notes:
      'Defaults only. NY districts vary on start/end dates and cutoffs. Use org-level overrides for accuracy.',
  },

  /**
   * UK (England/Wales-style labeling defaults)
   * - Academic year commonly runs from early September to late July.
   * - UK Reception corresponds roughly to US Kindergarten (age ~4–5).
   *   If you do age-based suggestion, you’ll likely want UK-specific mapping logic
   *   (Reception/Year 1 etc.). We keep cutoff as optional here.
   */
  uk: {
    id: 'uk',
    displayName: 'United Kingdom',
    timezone: 'Europe/London',
    yearStart: { month: 9, day: 1 },
    yearEnd: { month: 7, day: 31 },
    rollover: {
      proposeBeforeEndDays: 60,
      confirmAfterStartDays: 45,
    },
    gradeSuggestion: {
      enableAgeBasedSuggestion: true,
      // UK cutoffs can be tied to being 4 by Aug 31 for Reception in England.
      // Leave as a default; confirm in UI.
      kindergartenCutoff: { month: 8, day: 31 },
      kindergartenReferenceAge: 4,
    },
    notes:
      'Defaults only. UK admission/cutoff rules differ across England/Scotland/Wales/NI. Confirm with parent.',
  },

  /**
   * Sri Lanka (DEFAULTS)
   * - Sri Lanka school year often aligns to the calendar year (Jan–Dec),
   *   though exact term dates can vary.
   */
  sri_lanka: {
    id: 'sri_lanka',
    displayName: 'Sri Lanka',
    timezone: 'Asia/Colombo',
    yearStart: { month: 1, day: 1 },
    yearEnd: { month: 12, day: 31 },
    rollover: {
      proposeBeforeEndDays: 45,
      confirmAfterStartDays: 30,
    },
    gradeSuggestion: {
      enableAgeBasedSuggestion: true,
      // Cutoffs can vary; keep conservative.
      kindergartenCutoff: { month: 1, day: 31 },
      kindergartenReferenceAge: 5,
    },
    notes:
      'Defaults only. Sri Lanka term structure is typically within the calendar year; confirm grade transitions with guardians.',
  },

  /**
   * Australia (DEFAULTS)
   * - School year typically starts late Jan/early Feb and ends mid-Dec.
   * - States/territories vary; some call first year "Foundation" or "Prep".
   */
  australia: {
    id: 'australia',
    displayName: 'Australia',
    timezone: 'Australia/Sydney',
    yearStart: { month: 2, day: 1 },
    yearEnd: { month: 12, day: 15 },
    rollover: {
      proposeBeforeEndDays: 45,
      confirmAfterStartDays: 30,
    },
    gradeSuggestion: {
      enableAgeBasedSuggestion: true,
      // Many states have cutoffs around Apr/May/Jul; varies widely.
      // Keep a neutral default and require confirmation.
      kindergartenCutoff: { month: 4, day: 30 },
      kindergartenReferenceAge: 5,
    },
    notes:
      'Defaults only. Australia cutoffs and Foundation/Prep naming vary by state; use org overrides for accuracy.',
  },
});

/**
 * Returns the default policy for a region/country.
 * In production, prefer: orgPolicyOverride ?? this default.
 */
export function getAcademicYearPolicy(region: CountryOrRegion): AcademicYearPolicy {
  return ACADEMIC_YEAR_POLICIES[region];
}

/**
 * Compute academic year key (e.g., "2025-2026") for a date, using policy yearStart.
 *
 * Works for:
 * - Sep->Jun years (US/UK) and
 * - Jan->Dec years (Sri Lanka),
 * - Feb->Dec years (Australia).
 */
export function academicYearForDate(
  date: Date,
  policy: AcademicYearPolicy,
): AcademicYearKey {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 1-12
  const d = date.getUTCDate();

  const startsInThisCalendarYear = isOnOrAfter({ month: m, day: d }, policy.yearStart);

  // If the academic year starts later in the calendar year (e.g., Sep),
  // then dates before start belong to the previous academic year.
  // If it starts early (e.g., Jan/Feb), dates after start belong to current-year-based key.
  //
  // We build key as:
  // - If yearStart is Jan 1: academic year is "YYYY-YYYY" (same), but we still emit "YYYY-YYYY+1"?
  //   For consistency, we emit "YYYY-YYYY" only if it’s a calendar-year system.
  //
  // To keep it consistent across systems, we choose:
  // - For Jan-start systems: "YYYY-YYYY" (e.g., "2026-2026")
  // - For non-Jan start systems: "YYYY-YYYY+1" (e.g., "2025-2026")
  const isCalendarYearSystem = policy.yearStart.month === 1 && policy.yearStart.day === 1;

  if (isCalendarYearSystem) {
    // "2026-2026"
    return `${y}-${y}` as AcademicYearKey;
  }

  const startYear = startsInThisCalendarYear ? y : y - 1;
  const endYear = startYear + 1;

  return `${startYear}-${endYear}` as AcademicYearKey;
}

/**
 * Get the next academic year key.
 */
export function nextAcademicYear(key: AcademicYearKey): AcademicYearKey {
  const [a, b] = key.split('-').map((x) => Number(x));
  // Handle calendar-year style "2026-2026" as well.
  const nextA = a + 1;
  const nextB = b + 1;
  return `${nextA}-${nextB}` as AcademicYearKey;
}

/**
 * Determine if "today" is in the rollover proposal window (near academic year end),
 * based on the policy.
 *
 * Typical usage:
 * - If true: create proposed next-year enrollments + prompt guardians to confirm.
 */
export function isInRolloverProposalWindow(
  now: Date,
  policy: AcademicYearPolicy,
): boolean {
  const { end } = academicYearStartEndDates(now, policy);
  const endMs = end.getTime();
  const nowMs = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const daysUntilEnd = Math.floor((endMs - nowMs) / msPerDay);
  return daysUntilEnd <= policy.rollover.proposeBeforeEndDays && daysUntilEnd >= 0;
}

/**
 * Returns start/end Date objects for the academic year that contains `now`.
 * Uses UTC dates for determinism; you can adapt to timezone with Temporal later.
 */
export function academicYearStartEndDates(
  now: Date,
  policy: AcademicYearPolicy,
): Readonly<{ start: Date; end: Date }> {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();

  const calendarYearSystem = policy.yearStart.month === 1 && policy.yearStart.day === 1;

  if (calendarYearSystem) {
    const start = utcDate(y, policy.yearStart.month, policy.yearStart.day);
    const end = utcDate(y, policy.yearEnd.month, policy.yearEnd.day);
    return { start, end };
  }

  const startsInThisCalendarYear = isOnOrAfter({ month: m, day: d }, policy.yearStart);
  const startYear = startsInThisCalendarYear ? y : y - 1;
  const endYear = startYear + 1;

  const start = utcDate(startYear, policy.yearStart.month, policy.yearStart.day);
  const end = utcDate(endYear, policy.yearEnd.month, policy.yearEnd.day);

  return { start, end };
}

/** -----------------------
 * Small utilities
 * ---------------------- */

function utcDate(year: number, month: number, day: number): Date {
  // month is 1-12
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function isOnOrAfter(a: MonthDay, b: MonthDay): boolean {
  if (a.month !== b.month) return a.month > b.month;
  return a.day >= b.day;
}
