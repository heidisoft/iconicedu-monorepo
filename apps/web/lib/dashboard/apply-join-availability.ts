import type { ClassSessionJoinAvailabilityVM } from '@iconicedu/shared-types';

import type {
  DashboardUpcomingSessionListItem,
  DashboardUpcomingSessionsPage,
  DashboardUpcomingSessionsSectionPage,
} from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

function buildAvailabilityKey(scheduleId: string, occurrenceKey: string) {
  return `${scheduleId}|${occurrenceKey}`;
}

export function buildJoinEligibilityIndex(
  availability: ClassSessionJoinAvailabilityVM[],
): Map<string, boolean> {
  return new Map(
    availability.map((entry) => [
      buildAvailabilityKey(entry.occurrence.scheduleId, entry.occurrence.occurrenceKey),
      entry.eligible,
    ]),
  );
}

function applyToItem(
  item: DashboardUpcomingSessionListItem,
  eligibilityByOccurrence: Map<string, boolean>,
): DashboardUpcomingSessionListItem {
  if (!item.scheduleId || !item.occurrenceKey) {
    return { ...item, joinEligible: false };
  }

  return {
    ...item,
    // Absent from the index means the API did not consider this occurrence
    // joinable, so the card renders without a Join rather than with a dead one.
    joinEligible:
      eligibilityByOccurrence.get(
        buildAvailabilityKey(item.scheduleId, item.occurrenceKey),
      ) ?? false,
  };
}

function applyToSection(
  section: DashboardUpcomingSessionsSectionPage,
  eligibilityByOccurrence: Map<string, boolean>,
): DashboardUpcomingSessionsSectionPage {
  return {
    ...section,
    items: section.items.map((item) => applyToItem(item, eligibilityByOccurrence)),
  };
}

/**
 * Stamp API-decided join eligibility onto the dashboard's session cards.
 *
 * The dashboard decides *what to show* from the viewer's schedule scope, but not
 * *whether Join works* — that answer comes from the API so a card is never
 * rendered with a Join the endpoint would reject (issue #195).
 */
export function applyJoinAvailabilityToUpcomingSessions(
  page: DashboardUpcomingSessionsPage,
  availability: ClassSessionJoinAvailabilityVM[],
): DashboardUpcomingSessionsPage {
  const eligibilityByOccurrence = buildJoinEligibilityIndex(availability);

  return {
    today: applyToSection(page.today, eligibilityByOccurrence),
    thisWeek: applyToSection(page.thisWeek, eligibilityByOccurrence),
    nextWeek: applyToSection(page.nextWeek, eligibilityByOccurrence),
  };
}
