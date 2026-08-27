import { describe, expect, it } from 'vitest';
import type { ClassSessionJoinAvailabilityVM } from '@iconicedu/shared-types';

import { applyJoinAvailabilityToUpcomingSessions } from '@iconicedu/web/lib/dashboard/apply-join-availability';
import type {
  DashboardUpcomingSessionListItem,
  DashboardUpcomingSessionsPage,
} from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

function buildItem(
  overrides: Partial<DashboardUpcomingSessionListItem>,
): DashboardUpcomingSessionListItem {
  return {
    session: {
      id: 'schedule-1__2026-04-10T10:00:00.000Z',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-04-10T10:00:00.000Z',
      label: 'Algebra',
      time: 'Fri 10:00am',
      dayName: 'Fri',
      dayNum: '10',
      isToday: false,
      isLive: false,
      isPast: false,
      endAt: '2026-04-10T11:00:00.000Z',
      status: 'scheduled',
    },
    channelId: 'channel-1',
    joinHref: '/iconic-academy/s/channel-1',
    chatHref: '/iconic-academy/s/channel-1',
    weekBucket: 'next-week',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-04-10T10:00:00.000Z',
    ...overrides,
  } as DashboardUpcomingSessionListItem;
}

function buildPage(items: DashboardUpcomingSessionListItem[]) {
  return {
    today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
    thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
    nextWeek: { items, total: items.length, pageSize: 3, totalPages: 1 },
  } satisfies DashboardUpcomingSessionsPage;
}

function buildAvailability(
  overrides: Partial<ClassSessionJoinAvailabilityVM['occurrence']> & {
    eligible: boolean;
  },
): ClassSessionJoinAvailabilityVM {
  const { eligible, ...occurrence } = overrides;
  return {
    occurrence: {
      orgId: 'org-1',
      channelId: 'channel-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-04-10T10:00:00.000Z',
      ...occurrence,
    },
    effectiveStartAt: '2026-04-10T10:00:00.000Z',
    effectiveEndAt: '2026-04-10T11:00:00.000Z',
    eligible,
    action: eligible ? 'join_integrated' : null,
    provider: eligible ? 'daily' : null,
    reason: eligible ? null : 'not_authorized',
  };
}

describe('applyJoinAvailabilityToUpcomingSessions', () => {
  it('marks an occurrence the API said is eligible', () => {
    const page = applyJoinAvailabilityToUpcomingSessions(buildPage([buildItem({})]), [
      buildAvailability({ eligible: true }),
    ]);

    expect(page.nextWeek.items[0]!.joinEligible).toBe(true);
  });

  it('marks an occurrence the API denied as ineligible', () => {
    const page = applyJoinAvailabilityToUpcomingSessions(buildPage([buildItem({})]), [
      buildAvailability({ eligible: false }),
    ]);

    expect(page.nextWeek.items[0]!.joinEligible).toBe(false);
  });

  it('treats an occurrence the API did not mention as ineligible', () => {
    const page = applyJoinAvailabilityToUpcomingSessions(buildPage([buildItem({})]), []);

    expect(page.nextWeek.items[0]!.joinEligible).toBe(false);
  });

  it('does not let one occurrence eligibility leak onto another in the same schedule', () => {
    const page = applyJoinAvailabilityToUpcomingSessions(
      buildPage([
        buildItem({ occurrenceKey: '2026-04-10T10:00:00.000Z' }),
        buildItem({ occurrenceKey: '2026-04-17T10:00:00.000Z' }),
      ]),
      [buildAvailability({ eligible: true, occurrenceKey: '2026-04-10T10:00:00.000Z' })],
    );

    expect(page.nextWeek.items[0]!.joinEligible).toBe(true);
    expect(page.nextWeek.items[1]!.joinEligible).toBe(false);
  });

  it('marks an item with no occurrence identity as ineligible', () => {
    const page = applyJoinAvailabilityToUpcomingSessions(
      buildPage([buildItem({ scheduleId: null, occurrenceKey: null })]),
      [buildAvailability({ eligible: true })],
    );

    expect(page.nextWeek.items[0]!.joinEligible).toBe(false);
  });
});
