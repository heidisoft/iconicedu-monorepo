// @vitest-environment jsdom

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import ClassSchedulePage from './page';

const buildClassSchedulesByOrgMock = vi.fn();
const getDashboardAccountContextMock = vi.fn();
const getDashboardProfileContextMock = vi.fn();
const classScheduleClientMock = vi.fn(() => null);
const enableClassScheduleStaffCancelRunMock = vi.fn(async () => false);

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: (...args: unknown[]) => buildClassSchedulesByOrgMock(...args),
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth', () => ({
  getDashboardAccountContext: (...args: unknown[]) =>
    getDashboardAccountContextMock(...args),
  getDashboardProfileContext: (...args: unknown[]) =>
    getDashboardProfileContextMock(...args),
}));

vi.mock(
  '@iconicedu/web/app/(app)/[orgSlug]/class-schedule/class-schedule-client',
  () => ({
    ClassScheduleClient: (props: unknown) => classScheduleClientMock(props),
  }),
);

vi.mock('@iconicedu/web/flags', () => ({
  enableClassScheduleStaffCancel: {
    run: (...args: unknown[]) => enableClassScheduleStaffCancelRunMock(...args),
  },
}));

function createSchedule(input: {
  id: string;
  participants: Array<{ profileId: string; role: 'child' | 'guardian' | 'educator' }>;
}): ClassScheduleVM {
  return {
    ids: { id: input.id, orgId: 'org-1' },
    title: input.id,
    startAt: '2026-03-21T10:00:00.000Z',
    endAt: '2026-03-21T11:00:00.000Z',
    status: 'scheduled',
    visibility: 'class-members',
    participants: input.participants.map((participant) => ({
      ids: { id: participant.profileId, orgId: 'org-1' },
      role: participant.role,
    })),
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    audit: {
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'profile-staff',
    },
  };
}

describe('class schedule page viewer scoping', () => {
  beforeEach(() => {
    buildClassSchedulesByOrgMock.mockReset();
    getDashboardAccountContextMock.mockReset();
    getDashboardProfileContextMock.mockReset();
    classScheduleClientMock.mockReset();
    enableClassScheduleStaffCancelRunMock.mockReset();

    getDashboardAccountContextMock.mockResolvedValue({
      supabase: {},
      account: { id: 'account-1', org_id: 'org-1', primary_role: 'guardian' },
    });
    enableClassScheduleStaffCancelRunMock.mockResolvedValue(false);
  });

  it('passes only child schedules when viewing as a child profile', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      createSchedule({
        id: 'schedule-child-allowed',
        participants: [{ profileId: 'child-1', role: 'child' }],
      }),
      createSchedule({
        id: 'schedule-child-denied',
        participants: [{ profileId: 'child-2', role: 'child' }],
      }),
      createSchedule({
        id: 'schedule-educator-only',
        participants: [{ profileId: 'educator-1', role: 'educator' }],
      }),
    ]);
    getDashboardProfileContextMock.mockResolvedValue({
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-child-1' },
        prefs: { timezone: 'America/New_York' },
      },
    });

    const element = await ClassSchedulePage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(classScheduleClientMock).toHaveBeenCalled();
    });

    expect(classScheduleClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canCancelSessions: false,
        orgSlug: 'iconic-academy',
        timezone: 'America/New_York',
        events: [
          expect.objectContaining({
            ids: expect.objectContaining({ id: 'schedule-child-allowed' }),
          }),
        ],
      }),
    );
  });

  it('keeps guardian calendar scoped to guardian family participants', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      createSchedule({
        id: 'schedule-child-allowed',
        participants: [{ profileId: 'child-1', role: 'child' }],
      }),
      createSchedule({
        id: 'schedule-guardian-allowed',
        participants: [{ profileId: 'guardian-1', role: 'guardian' }],
      }),
      createSchedule({
        id: 'schedule-unrelated-child',
        participants: [{ profileId: 'child-9', role: 'child' }],
      }),
    ]);
    getDashboardProfileContextMock.mockResolvedValue({
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-guardian-1' },
        prefs: { timezone: 'America/New_York' },
        children: {
          items: [{ ids: { id: 'child-1' } }],
        },
      },
    });

    const element = await ClassSchedulePage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(classScheduleClientMock).toHaveBeenCalled();
    });

    expect(classScheduleClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canCancelSessions: false,
        orgSlug: 'iconic-academy',
        events: [
          expect.objectContaining({
            ids: expect.objectContaining({ id: 'schedule-child-allowed' }),
          }),
          expect.objectContaining({
            ids: expect.objectContaining({ id: 'schedule-guardian-allowed' }),
          }),
        ],
      }),
    );
  });

  it('enables session cancellation for owners when the flag is on', async () => {
    getDashboardAccountContextMock.mockResolvedValue({
      supabase: {},
      account: { id: 'account-1', org_id: 'org-1', primary_role: 'owner' },
    });
    buildClassSchedulesByOrgMock.mockResolvedValue([
      createSchedule({
        id: 'schedule-staff-visible',
        participants: [{ profileId: 'child-1', role: 'child' }],
      }),
    ]);
    getDashboardProfileContextMock.mockResolvedValue({
      currentUserProfile: {
        kind: 'system',
        ids: { id: 'staff-1', orgId: 'org-1', accountId: 'account-staff-1' },
        prefs: { timezone: 'America/New_York' },
      },
    });
    enableClassScheduleStaffCancelRunMock.mockResolvedValue(true);

    const element = await ClassSchedulePage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(classScheduleClientMock).toHaveBeenCalled();
    });

    expect(enableClassScheduleStaffCancelRunMock).toHaveBeenCalledWith({
      identify: { profileId: 'staff-1' },
    });
    expect(classScheduleClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canCancelSessions: true,
        orgSlug: 'iconic-academy',
      }),
    );
  });
});
