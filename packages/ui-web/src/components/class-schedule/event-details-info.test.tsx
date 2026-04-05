// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { EventDetailsInfo } from './event-details-info';

function buildEvent(overrides?: Partial<ClassScheduleVM>): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Algebra',
    description: 'Session details',
    startAt: '2026-03-21T10:00:00.000Z',
    endAt: '2026-03-21T11:00:00.000Z',
    timezone: 'America/New_York',
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
      createdBy: 'profile-1',
    },
    ...overrides,
  };
}

describe('EventDetailsInfo', () => {
  it('shows participant names instead of the legacy "Event by" label', () => {
    render(
      <EventDetailsInfo
        event={buildEvent({
          participants: [
            { profileId: 'educator-1', role: 'educator', displayName: 'Alex Teacher' },
            { profileId: 'child-1', role: 'child', displayName: 'Liam Student' },
          ],
        })}
      />,
    );

    expect(screen.getByText('Alex Teacher, Liam Student')).toBeInTheDocument();
    expect(screen.queryByText(/Event by/i)).not.toBeInTheDocument();
  });
});
