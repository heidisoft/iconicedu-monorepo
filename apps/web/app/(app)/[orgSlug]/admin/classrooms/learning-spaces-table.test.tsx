import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { LearningSpacesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-table';
import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';

vi.mock('next/navigation', () => ({
  usePathname: () => '/iconic-academy/admin/classrooms',
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
    {
      id: 'profile-maya',
      displayName: 'Maya Johnson',
      kind: 'child',
      themeKey: 'rose',
    },
    {
      id: 'profile-leo',
      displayName: 'Leo Carter',
      kind: 'child',
      themeKey: 'sky',
    },
  ],
  primaryChannelId: 'channel-1',
  scheduleSummary: null,
  scheduleItems: null,
  updatedByDisplayName: 'Staff Admin',
};

describe('LearningSpacesTable', () => {
  it('renders participant names under the subject and removes the participants column', () => {
    render(<LearningSpacesTable rows={[baseRow]} onEdit={() => undefined} />);

    expect(screen.getByText('Algebra Foundations')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Maya Johnson, Leo Carter',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Maya Johnson')).toHaveClass('theme-rose');
    expect(screen.getByText('Leo Carter')).toHaveClass('theme-sky');
    expect(screen.getByText('Updated by Staff Admin')).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Participants' }),
    ).not.toBeInTheDocument();
  });
});
