/* @vitest-environment jsdom */

import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassScheduleVM, ClassScheduleViewVM } from '@iconicedu/shared-types';

import { ClassScheduleClient } from './class-schedule-client';

const { refresh, searchParamsGetMock, classScheduleContainerMock } = vi.hoisted(() => ({
  refresh: vi.fn(),
  searchParamsGetMock: vi.fn<(key: string) => string | null>(),
  classScheduleContainerMock: vi.fn(
    ({ view, currentDate }: { view: ClassScheduleViewVM; currentDate: Date }) => (
      <div
        data-testid="class-schedule-container"
        data-view={view}
        data-date={currentDate.toISOString()}
      />
    ),
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

vi.mock('@iconicedu/ui-web', () => ({
  ClassScheduleContainer: classScheduleContainerMock,
  DashboardHeader: ({ title }: { title: string }) => <div>{title}</div>,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@iconicedu/ui-web/components/shared/schedule-display-timezone-context', () => ({
  ScheduleDisplayTimeZoneProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@iconicedu/web/app/actions/cancel-class-schedule-session', () => ({
  cancelClassScheduleSessionAction: vi.fn(),
}));

vi.mock('@iconicedu/web/app/actions/update-class-schedule-session', () => ({
  updateClassScheduleSessionAction: vi.fn(),
}));

function createSchedule(): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Algebra',
    startAt: '2026-03-21T10:00:00.000Z',
    endAt: '2026-03-21T11:00:00.000Z',
    status: 'scheduled',
    visibility: 'class-members',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    audit: {
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'account-1',
    },
  };
}

describe('ClassScheduleClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGetMock.mockImplementation((key: string) => {
      if (key === 'date') return null;
      if (key === 'view') return null;
      return null;
    });
  });

  it('defaults to week view when no view query param is provided', () => {
    render(
      <ClassScheduleClient
        events={[createSchedule()]}
        orgSlug="iconic-academy"
        canCancelSessions={false}
        canEditSessions={false}
        timezone="America/New_York"
      />,
    );

    expect(classScheduleContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        view: 'week',
      }),
      undefined,
    );
  });

  it('passes the full schedule editor link when session editing is allowed', () => {
    render(
      <ClassScheduleClient
        events={[createSchedule()]}
        orgSlug="iconic-academy"
        canCancelSessions
        canEditSessions
        timezone="America/New_York"
      />,
    );

    expect(classScheduleContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editFullScheduleHref: '/iconic-academy/admin/classrooms',
      }),
      undefined,
    );
  });

  it('respects an explicit day view query param', () => {
    searchParamsGetMock.mockImplementation((key: string) => {
      if (key === 'view') return 'day';
      return null;
    });

    render(
      <ClassScheduleClient
        events={[createSchedule()]}
        orgSlug="iconic-academy"
        canCancelSessions={false}
        canEditSessions={false}
        timezone="America/New_York"
      />,
    );

    expect(classScheduleContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        view: 'day',
      }),
      undefined,
    );
  });
});
