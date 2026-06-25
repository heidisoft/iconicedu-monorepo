import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { LearningSpacesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-table';
import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';

vi.mock('next/navigation', () => ({
  usePathname: () => '/iconic-academy/admin/classrooms',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}

const baseRow: AdminLearningSpaceRow = {
  id: 'space-1',
  org_id: 'org-1',
  kind: 'small_group',
  status: 'active',
  title: 'Algebra Foundations',
  icon_key: 'book-open',
  subject: 'Math',
  description: 'Foundational algebra',
  created_at: '2025-01-01T00:00:00.000Z',
  created_by: null,
  updated_at: '2025-01-02T00:00:00.000Z',
  updated_by: 'profile-staff',
  archived_at: null,
  deleted_at: null,
  deleted_by: null,
  themeKey: 'teal',
  participantNames: ['Maya Johnson', 'Leo Carter'],
  participantDetails: [
    { id: 'profile-maya', displayName: 'Maya Johnson', kind: 'child', themeKey: 'rose' },
    { id: 'profile-leo', displayName: 'Leo Carter', kind: 'child', themeKey: 'sky' },
  ],
  primaryChannelId: 'channel-1',
  scheduleSummary: null,
  scheduleItems: null,
  updatedByDisplayName: 'Staff Admin',
};

describe('LearningSpacesTable', () => {
  it('renders title, subject and participant chips', () => {
    render(<LearningSpacesTable rows={[baseRow]} orgSlug="iconic-academy" />);

    expect(screen.getByText('Algebra Foundations')).toBeInTheDocument();
    expect(screen.getByText('Maya Johnson')).toBeInTheDocument();
    expect(screen.getByText('Leo Carter')).toBeInTheDocument();
  });

  it('shows "No schedule" when scheduleItems is empty', () => {
    render(<LearningSpacesTable rows={[baseRow]} orgSlug="iconic-academy" />);
    expect(screen.getByText('No schedule')).toBeInTheDocument();
  });

  it('collapses extra schedules behind "+N more" and expands on click', async () => {
    const rowWithSchedules: AdminLearningSpaceRow = {
      ...baseRow,
      scheduleItems: [
        { kind: 'weekly', summary: 'Weekly · Mon · 9:00 AM – 10:00 AM' },
        { kind: 'weekly', summary: 'Weekly · Wed · 9:00 AM – 10:00 AM' },
        { kind: 'weekly', summary: 'Weekly · Fri · 9:00 AM – 10:00 AM' },
      ],
    };

    const user = userEvent.setup();
    render(<LearningSpacesTable rows={[rowWithSchedules]} orgSlug="iconic-academy" />);

    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.queryByText(/Fri/)).not.toBeInTheDocument();

    await user.click(screen.getByText('+1 more'));

    expect(screen.queryByText('+1 more')).not.toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('shows direct row action buttons', () => {
    render(<LearningSpacesTable rows={[baseRow]} orgSlug="iconic-academy" />);

    expect(
      screen.getByRole('button', { name: 'Edit Algebra Foundations' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archive Algebra Foundations' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Algebra Foundations' }),
    ).toBeInTheDocument();
  });
});
