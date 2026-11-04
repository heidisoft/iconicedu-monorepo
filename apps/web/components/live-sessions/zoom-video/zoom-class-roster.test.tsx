import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ZoomClassRoster } from './zoom-class-roster';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
const roster: ClassroomRosterVM = {
  enabled: true,
  canCall: true,
  members: [
    {
      profileId: 'absent',
      displayName: 'Absent student',
      kind: 'child',
      joined: false,
      canCall: true,
    },
    {
      profileId: 'joined',
      displayName: 'Joined student',
      kind: 'child',
      joined: true,
      canCall: false,
    },
  ],
};
describe('class roster', () => {
  it('shows enrolled absentees and offers Call only when the API permits it', () => {
    const call = vi.fn();
    render(
      <ZoomClassRoster
        roster={roster}
        error={null}
        pending={null}
        call={call}
        cancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Absent student')).toBeInTheDocument();
    expect(screen.queryByText('Joined student')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Call Joined student')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Call Absent student'));
    expect(call).toHaveBeenCalledWith('absent');
  });
  it('cancels a ringing invitation and disables actions while a request is pending', () => {
    const cancel = vi.fn();
    const value = {
      ...roster,
      members: [
        {
          ...roster.members[0],
          call: {
            id: 'call',
            sessionId: 'session',
            classTitle: 'Class',
            callerName: 'Teacher',
            status: 'ringing' as const,
            expiresAt: new Date(Date.now() + 45_000).toISOString(),
          },
        },
      ],
    };
    const view = render(
      <ZoomClassRoster
        roster={value}
        error={null}
        pending={null}
        call={vi.fn()}
        cancel={cancel}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel call to Absent student' }),
    );
    expect(cancel).toHaveBeenCalledWith('call');
    view.rerender(
      <ZoomClassRoster
        roster={value}
        error="Unable to call"
        pending="absent"
        call={vi.fn()}
        cancel={cancel}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Cancel call to Absent student' }),
    ).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to call');
  });
  it('does not expose roster controls when rollout is off', () => {
    render(
      <ZoomClassRoster
        roster={null}
        error={null}
        pending={null}
        call={vi.fn()}
        cancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
