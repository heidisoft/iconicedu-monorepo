import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import { CompletedSessionsTable } from './completed-sessions-table';

const row: AdminSessionCompletionVM = {
  id: 'one',
  orgId: 'org',
  scheduleId: 'schedule',
  occurrenceKey: '2026-09-01T12:00:00Z',
  sessionEndAt: '2026-09-01T13:00:00Z',
  completedAt: '2026-09-01T13:10:00Z',
  studentNames: ['Student'],
  completionMethod: 'confirmed',
  guardians: [],
  confirmedBy: [],
  averageRating: 4.5,
  participants: [
    {
      profileId: 'tutor',
      displayName: 'Tutor One',
      role: 'educator',
      status: 'confirmed',
      rating: 5,
    },
    {
      profileId: 'parent',
      displayName: 'Parent One',
      role: 'guardian',
      status: 'pending',
    },
    {
      profileId: 'parent-two',
      displayName: 'Parent Two',
      role: 'guardian',
      status: 'auto_confirmed',
      rating: 4,
    },
    {
      profileId: 'parent-three',
      displayName: 'Parent Three',
      role: 'guardian',
      status: 'disputed',
    },
  ],
};

describe('CompletedSessionsTable', () => {
  it('shows confirmation states and each person’s rating in the confirmation cell', () => {
    render(<CompletedSessionsTable rows={[row]} schedules={[]} orgId="org" />);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Session',
      'Ended',
      'Duration',
      'Students',
      'Confirmed by',
      'Actions',
    ]);
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    const people = screen.getAllByRole('listitem');
    expect(within(people[0]).getByText('(Tutor) · Confirmed')).toBeInTheDocument();
    expect(within(people[0]).getByText('Rating: 5.0 / 5')).toBeInTheDocument();
    expect(within(people[1]).getByText('(Parent) · Pending')).toBeInTheDocument();
    expect(within(people[1]).queryByText(/Rating:/)).not.toBeInTheDocument();
    expect(
      within(people[2]).getByText(/Auto-confirmed; awaiting personal confirmation/),
    ).toBeInTheDocument();
    expect(within(people[2]).getByText('Rating: 4.0 / 5')).toBeInTheDocument();
    expect(within(people[3]).getByText('(Parent) · Disputed')).toBeInTheDocument();
    expect(screen.queryByText('4.5 / 5')).not.toBeInTheDocument();
    // A disputed participant blocks the staff "Confirm" action for the occurrence.
    expect(screen.getByText('Dispute reported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('excludes staff and children from the compatibility fallback', () => {
    render(
      <CompletedSessionsTable
        rows={[
          {
            ...row,
            participants: undefined,
            guardians: [{ profileId: 'parent', displayName: 'Waiting Parent' }],
            confirmedBy: ['staff', 'child'].map((role) => ({
              profileId: role,
              displayName: `Hidden ${role}`,
              role: role as 'staff' | 'child',
              status: 'confirmed',
              completedAt: row.completedAt,
            })),
          },
        ]}
        schedules={[]}
        orgId="org"
      />,
    );
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting Parent/)).toBeInTheDocument();
    expect(screen.getByText('(Parent) · Pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('spans the six columns for an empty result', () => {
    render(<CompletedSessionsTable rows={[]} schedules={[]} orgId="org" />);
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '6');
  });
});
