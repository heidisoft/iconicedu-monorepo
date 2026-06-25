/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { UsersTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table';
import type { AdminUserRow } from '@iconicedu/web/lib/admin/users';

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgSlug: 'iconic-academy' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/admin/users/invite-dialog', () => ({
  InviteUserDialog: () => <div>Invite user</div>,
}));

vi.mock('@iconicedu/ui-web/components/shared/avatar-with-status', () => ({
  AvatarWithStatus: ({ name }: { name: string }) => <div>{name}</div>,
  getAvatarRoleLabel: (kind: string | null | undefined) => kind ?? null,
  getAvatarLocationLabel: () => null,
}));

function buildRow(
  overrides: Partial<AdminUserRow> & Pick<AdminUserRow, 'id' | 'updatedAt'>,
): AdminUserRow {
  return {
    id: overrides.id,
    orgId: 'org-1',
    email: `${overrides.id}@example.com`,
    phone: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt,
    lastSeenAt: overrides.lastSeenAt ?? null,
    profileId: `${overrides.id}-profile`,
    displayName: overrides.displayName ?? overrides.id,
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    profileKind: overrides.profileKind ?? 'staff',
    avatarUrl: null,
    avatarSource: 'seed',
    themeKey: 'teal',
    countryName: 'United States',
    timezone: 'America/New_York',
    primaryRole: null,
    roleStatus: null,
    linkedChildAccountIds: [],
    linkedGuardianAccountIds: [],
  };
}

describe('UsersTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders user names as text without opening a profile preview', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/users/list?')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            rows: [
              buildRow({
                id: 'newer-seen-user',
                displayName: 'Newer Seen User',
                updatedAt: '2026-01-05T00:00:00.000Z',
                lastSeenAt: '2026-01-15T00:00:00.000Z',
              }),
              buildRow({
                id: 'older-user',
                displayName: 'Older User',
                updatedAt: '2026-01-10T00:00:00.000Z',
                lastSeenAt: '2026-01-01T00:00:00.000Z',
              }),
            ],
            total: 2,
            pageCount: 1,
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<UsersTable orgSlug="i" />);

    expect(await screen.findAllByText('Newer Seen User')).toHaveLength(2);
    expect(screen.getAllByText('Older User')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Newer Seen User' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/list?orgSlug=i&page=1');
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('profile-preview')),
    ).toBe(false);
  });
});
