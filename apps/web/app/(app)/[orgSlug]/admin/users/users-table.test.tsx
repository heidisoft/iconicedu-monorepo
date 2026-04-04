/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function expectBefore(labelA: string, labelB: string) {
  const first = screen.getByRole('button', { name: labelA }).closest('tr');
  const second = screen.getByRole('button', { name: labelB }).closest('tr');

  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(first?.compareDocumentPosition(second as Node)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe('UsersTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to most recently seen first and toggles last seen sorting', () => {
    render(
      <UsersTable
        rows={[
          buildRow({
            id: 'older-user',
            displayName: 'Older User',
            updatedAt: '2026-01-10T00:00:00.000Z',
            lastSeenAt: '2026-01-01T00:00:00.000Z',
          }),
          buildRow({
            id: 'newer-seen-user',
            displayName: 'Newer Seen User',
            updatedAt: '2026-01-05T00:00:00.000Z',
            lastSeenAt: '2026-01-15T00:00:00.000Z',
          }),
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /Updated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last seen/i })).toBeInTheDocument();

    expectBefore('Newer Seen User', 'Older User');

    fireEvent.click(screen.getByRole('button', { name: /Last seen/i }));

    expectBefore('Older User', 'Newer Seen User');
  });

  it('opens the preview dialog from the user name and shows metadata ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        payload: {
          account: {
            ids: { id: 'user-1', orgId: 'org-1' },
            contacts: { email: 'iconicedudev+user-1@gmail.com' },
            lifecycle: {
              status: 'active',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          },
          profile: {
            kind: 'staff',
            ids: { id: 'profile-1', orgId: 'org-1', accountId: 'user-1' },
            profile: { displayName: 'Preview User', avatar: { source: 'seed' } },
            prefs: {},
            meta: {
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
            department: 'Operations',
          },
          metadata: {
            accountId: 'user-1',
            accountOrgId: 'org-1',
            profileId: 'profile-1',
            profileOrgId: 'org-1',
            profileAccountId: 'user-1',
            authUserId: null,
            managerStaffId: 'manager-1',
            childProfileIds: [],
            childAccountIds: [],
            notificationScopeIds: ['scope-1'],
            familyInviteIds: [],
            familyInviteFamilyIds: [],
            familyInviteAcceptedByAccountIds: [],
            familyInviteCreatedByAccountIds: [],
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UsersTable
        rows={[
          buildRow({
            id: 'user-1',
            displayName: 'Preview User',
            updatedAt: '2026-01-10T00:00:00.000Z',
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview User' }));

    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/profile-preview?accountId=user-1',
      );
    });

    const metadataTab = screen.getByRole('tab', { name: /metadata/i });
    fireEvent.mouseDown(metadataTab);
    fireEvent.click(metadataTab);

    expect(await screen.findByText('Manager staff UUID')).toBeInTheDocument();
    expect(screen.getByText('manager-1')).toBeInTheDocument();
    expect(screen.getByText('scope-1')).toBeInTheDocument();
  });
});
