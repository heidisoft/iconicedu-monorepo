import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import type { ScheduleOptionRow } from '@iconicedu/web/lib/api/schedules';
import {
  CompletedSessionsTable,
  filterSchedulesByStudent,
  listScheduleStudentOptions,
} from './completed-sessions-table';

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
      'Session time',
      'Confirmed by',
      'Actions',
    ]);
    // Session combines the title with its student names underneath.
    expect(screen.getByText('Student')).toBeInTheDocument();
    // Session time combines the date with a start–end (duration) range —
    // the times themselves render in the local timezone, so only assert the
    // timezone-independent duration.
    expect(screen.getByText(/\(1h 0m\)/)).toBeInTheDocument();
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

  it('shows who confirmed on a participant’s behalf when staff overrode it', () => {
    render(
      <CompletedSessionsTable
        rows={[
          {
            ...row,
            participants: [
              {
                profileId: 'tutor',
                displayName: 'Tutor One',
                role: 'educator',
                status: 'confirmed',
                confirmedByStaff: {
                  profileId: 'staff-1',
                  displayName: 'Admin Ada',
                  confirmedAt: '2026-09-01T13:15:00Z',
                },
              },
              {
                profileId: 'parent',
                displayName: 'Parent One',
                role: 'guardian',
                status: 'confirmed',
              },
            ],
          },
        ]}
        schedules={[]}
        orgId="org"
      />,
    );
    const people = screen.getAllByRole('listitem');
    expect(
      within(people[0]).getByText(/Confirmed by staff: Admin Ada/),
    ).toBeInTheDocument();
    expect(within(people[1]).queryByText(/Confirmed by staff/)).not.toBeInTheDocument();
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

  it('spans the four columns for an empty result', () => {
    render(<CompletedSessionsTable rows={[]} schedules={[]} orgId="org" />);
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '4');
  });
});

describe('listScheduleStudentOptions', () => {
  const schedules: ScheduleOptionRow[] = [
    {
      id: 'algebra',
      title: 'Algebra',
      status: 'active',
      timezone: 'UTC',
      participants: [
        { profile_id: 'jamie', role: 'child', display_name: 'Jamie Lee' },
        { profile_id: 'tutor', role: 'educator', display_name: 'Tutor One' },
      ],
    },
    {
      id: 'reading',
      title: 'Reading',
      status: 'active',
      timezone: 'UTC',
      participants: [
        { profile_id: 'alex', role: 'child', display_name: 'Alex Kim' },
        { profile_id: 'jamie', role: 'child', display_name: 'Jamie Lee' },
      ],
    },
  ];

  it('deduplicates students across classrooms and sorts by name', () => {
    expect(listScheduleStudentOptions(schedules)).toEqual([
      { profileId: 'alex', displayName: 'Alex Kim' },
      { profileId: 'jamie', displayName: 'Jamie Lee' },
    ]);
  });

  it('excludes non-child participants and falls back for a blank name', () => {
    const withBlankName: ScheduleOptionRow[] = [
      {
        id: 'algebra',
        title: 'Algebra',
        status: 'active',
        timezone: 'UTC',
        participants: [
          { profile_id: 'guardian-1', role: 'guardian', display_name: 'Parent One' },
          { profile_id: 'child-1', role: 'child', display_name: '  ' },
        ],
      },
    ];
    expect(listScheduleStudentOptions(withBlankName)).toEqual([
      { profileId: 'child-1', displayName: 'Unnamed student' },
    ]);
  });

  it('handles schedules with no participants', () => {
    expect(
      listScheduleStudentOptions([{ ...schedules[0], participants: undefined }]),
    ).toEqual([]);
  });
});

describe('filterSchedulesByStudent', () => {
  const schedules: ScheduleOptionRow[] = [
    {
      id: 'algebra',
      title: 'Algebra',
      status: 'active',
      timezone: 'UTC',
      participants: [{ profile_id: 'jamie', role: 'child', display_name: 'Jamie Lee' }],
    },
    {
      id: 'reading',
      title: 'Reading',
      status: 'active',
      timezone: 'UTC',
      participants: [{ profile_id: 'alex', role: 'child', display_name: 'Alex Kim' }],
    },
  ];

  it('returns nothing until a student is chosen', () => {
    expect(filterSchedulesByStudent(schedules, '')).toEqual([]);
  });

  it('narrows to only the classrooms the chosen student is on', () => {
    expect(filterSchedulesByStudent(schedules, 'jamie').map((s) => s.id)).toEqual([
      'algebra',
    ]);
  });
});
