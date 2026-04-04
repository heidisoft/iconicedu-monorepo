// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { EventActions } from './event-actions';

function buildEvent(overrides?: Partial<ClassScheduleVM>): ClassScheduleVM {
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
      createdBy: 'profile-1',
    },
    ...overrides,
  };
}

describe('EventActions', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/iconic-academy/class-schedule');
  });

  it('renders view full schedule link to classroom schedule tab', () => {
    render(<EventActions event={buildEvent()} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'View full schedule' });
    expect(link).toHaveAttribute('href', '/iconic-academy/s/channel-1#sessions');
  });

  it('disables view full schedule when event has no classroom channel', () => {
    render(
      <EventActions
        event={buildEvent({
          source: {
            kind: 'manual',
            createdByUserId: 'profile-2',
          },
        })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'View full schedule' })).toBeDisabled();
  });

  it('shows a cancel session action for staff-enabled events and submits the optional reason', async () => {
    const onCancelSession = vi.fn(async () => undefined);
    const onClose = vi.fn();

    render(
      <EventActions
        event={buildEvent()}
        onClose={onClose}
        canCancelSession
        onCancelSession={onCancelSession}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }));
    fireEvent.change(screen.getByLabelText('Reason (optional)'), {
      target: { value: 'Tutor unavailable' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    await waitFor(() => {
      expect(onCancelSession).toHaveBeenCalledWith(
        expect.objectContaining({ ids: expect.objectContaining({ id: 'schedule-1' }) }),
        'Tutor unavailable',
      );
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('hides the cancel session action for already cancelled events', () => {
    render(
      <EventActions
        event={buildEvent({ status: 'cancelled' })}
        onClose={vi.fn()}
        canCancelSession
        onCancelSession={vi.fn(async () => undefined)}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Cancel session' }),
    ).not.toBeInTheDocument();
  });
});
