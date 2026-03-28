/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

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
  it('defaults to most recently updated first and allows sorting by last seen', () => {
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

    expectBefore('Older User', 'Newer Seen User');

    fireEvent.click(screen.getByRole('button', { name: /Last seen/i }));

    expectBefore('Newer Seen User', 'Older User');
  });
});
