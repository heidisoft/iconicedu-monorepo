// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { DayView } from './day-view';
import { ScheduleDisplayTimeZoneProvider } from '../shared/schedule-display-timezone-context';

function buildEvent(
  id: string,
  title: string,
  startAt: string,
  endAt: string,
): ClassScheduleVM {
  return {
    ids: { id, orgId: 'org-1' },
    title,
    startAt,
    endAt,
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
  };
}

function renderDayView(events: ClassScheduleVM[]) {
  return render(
    <ScheduleDisplayTimeZoneProvider timezone="UTC">
      <DayView
        currentDate={new Date(2026, 2, 2)}
        events={events}
        classScheduleEvents={events}
        hasClasses
        childrenCount={1}
        onDateSelect={vi.fn()}
      />
    </ScheduleDisplayTimeZoneProvider>,
  );
}

describe('DayView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T15:30:00.000Z'));
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initially scrolls the current day to the current time', () => {
    renderDayView([
      buildEvent(
        'morning-event',
        'Morning event',
        '2026-03-02T09:00:00.000Z',
        '2026-03-02T10:00:00.000Z',
      ),
    ]);

    vi.runAllTimers();

    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
      top: 928,
      behavior: 'smooth',
    });
  });

  it('renders separate overflow badges aligned to each hidden start time', () => {
    const events = [
      buildEvent(
        'visible-1',
        'Visible 1',
        '2026-03-02T09:00:00.000Z',
        '2026-03-02T12:00:00.000Z',
      ),
      buildEvent(
        'visible-2',
        'Visible 2',
        '2026-03-02T09:00:00.000Z',
        '2026-03-02T12:00:00.000Z',
      ),
      buildEvent(
        'visible-3',
        'Visible 3',
        '2026-03-02T09:00:00.000Z',
        '2026-03-02T12:00:00.000Z',
      ),
      buildEvent(
        'hidden-1',
        'Hidden 1',
        '2026-03-02T10:00:00.000Z',
        '2026-03-02T12:00:00.000Z',
      ),
      buildEvent(
        'hidden-2',
        'Hidden 2',
        '2026-03-02T11:00:00.000Z',
        '2026-03-02T12:00:00.000Z',
      ),
    ];

    renderDayView(events);
    vi.runAllTimers();

    expect(screen.getByText('Visible 1')).toBeInTheDocument();
    expect(screen.getByText('Visible 2')).toBeInTheDocument();
    expect(screen.getByText('Visible 3')).toBeInTheDocument();
    expect(screen.queryByText('Hidden 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden 2')).not.toBeInTheDocument();

    const badges = screen.getAllByRole('button', { name: '+1 more' });
    expect(badges).toHaveLength(2);
    expect(badges[0]?.parentElement).toHaveStyle({ top: '640px' });
    expect(badges[1]?.parentElement).toHaveStyle({ top: '704px' });
  });

  /**
   * Regression coverage for #194 root cause 4. `2026-08-27T18:45Z` is Thursday
   * 14:45 in New York but already Friday 00:15 in Colombo.
   */
  describe('viewer-timezone today and current-time indicator', () => {
    const instant = new Date('2026-08-27T18:45:00.000Z');

    function renderDay(timezone: string) {
      return render(
        <ScheduleDisplayTimeZoneProvider timezone={timezone}>
          <DayView
            currentDate={new Date(2026, 7, 27)}
            events={[]}
            classScheduleEvents={[]}
            hasClasses
            childrenCount={1}
            onDateSelect={vi.fn()}
          />
        </ScheduleDisplayTimeZoneProvider>,
      );
    }

    it('treats the viewer date as today and places the line at viewer time', () => {
      vi.setSystemTime(instant);
      const { container } = renderDay('America/New_York');

      // Viewer is on Aug 27, so the indicator renders at 14:45.
      expect(container.querySelector('.border-destructive')).toHaveStyle({
        top: '944px',
      });
    });

    it('hides the indicator when the viewer has moved past the shown day', () => {
      vi.setSystemTime(instant);
      const { container } = renderDay('Asia/Colombo');

      // Viewer is already on Aug 28, so Aug 27 is no longer today.
      expect(container.querySelector('.border-destructive')).toBeNull();
    });
  });
});
