import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { LearningSpacesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-dashboard';
import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';

vi.mock('next/navigation', () => ({
  usePathname: () => '/iconic-academy/admin/classrooms',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

const makeRow = (overrides: Partial<AdminLearningSpaceRow>): AdminLearningSpaceRow => ({
  id: 'space-1',
  org_id: 'org-1',
  kind: 'small_group',
  status: 'active',
  title: 'Algebra Foundations',
  icon_key: 'book-open',
  subject: 'Math',
  description: null,
  created_at: '2025-01-01T00:00:00.000Z',
  created_by: null,
  updated_at: '2025-01-02T00:00:00.000Z',
  updated_by: null,
  archived_at: null,
  deleted_at: null,
  deleted_by: null,
  themeKey: 'teal',
  participantNames: ['Maya Johnson'],
  participantDetails: [{ id: 'profile-1', displayName: 'Maya Johnson', kind: 'child' }],
  primaryChannelId: 'channel-1',
  scheduleSummary: null,
  scheduleItems: null,
  updatedByDisplayName: 'Staff Admin',
  ...overrides,
});

const participantOptions: UserProfileVM[] = [
  {
    ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    kind: 'child',
    profile: {
      displayName: 'Maya Johnson',
      firstName: 'Maya',
      lastName: 'Johnson',
      avatar: { source: 'seed', url: null },
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    joinedDate: '2026-01-01T00:00:00.000Z',
  } as UserProfileVM,
  {
    ids: { id: 'profile-2', orgId: 'org-1', accountId: 'account-2' },
    kind: 'child',
    profile: {
      displayName: 'Leo Carter',
      firstName: 'Leo',
      lastName: 'Carter',
      avatar: { source: 'seed', url: null },
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    joinedDate: '2026-01-01T00:00:00.000Z',
  } as UserProfileVM,
];

describe('LearningSpacesDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters rows with the searchable participant combobox', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: participantOptions }),
    } as Response);

    const user = userEvent.setup();
    const rows = [
      makeRow({
        id: 'space-1',
        title: 'Algebra Foundations',
        participantNames: ['Maya Johnson'],
        participantDetails: [
          { id: 'profile-1', displayName: 'Maya Johnson', kind: 'child' },
        ],
      }),
      makeRow({
        id: 'space-2',
        title: 'Creative Writing',
        subject: 'English',
        participantNames: ['Leo Carter'],
        participantDetails: [
          { id: 'profile-2', displayName: 'Leo Carter', kind: 'child' },
        ],
      }),
    ];

    render(<LearningSpacesDashboard rows={rows} />);

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/spaces/participants',
        expect.objectContaining({ method: 'GET' }),
      ),
    );

    expect(screen.getByText('Algebra Foundations')).toBeInTheDocument();
    expect(screen.getByText('Creative Writing')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Filter by participant' }));
    await user.type(screen.getByPlaceholderText('Search participants...'), 'leo');
    await user.click(await screen.findByRole('option', { name: 'Leo Carter' }));

    expect(screen.queryByText('Algebra Foundations')).not.toBeInTheDocument();
    expect(screen.getByText('Creative Writing')).toBeInTheDocument();
  });
});
