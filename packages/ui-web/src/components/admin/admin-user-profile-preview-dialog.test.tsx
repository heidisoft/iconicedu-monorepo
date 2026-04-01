/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminUserProfilePreviewDialog } from './admin-user-profile-preview-dialog';

describe('AdminUserProfilePreviewDialog', () => {
  it('renders metadata ids in the metadata tab', async () => {
    render(
      <AdminUserProfilePreviewDialog
        open
        onOpenChange={() => undefined}
        account={{
          ids: { id: 'account-1', orgId: 'org-1' },
          contacts: { email: 'jamie@example.com' },
          lifecycle: {
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        }}
        profile={{
          kind: 'guardian',
          ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
          profile: { displayName: 'Jamie', avatar: { source: 'seed' } },
          prefs: {},
          joinedDate: '2026-01-01T00:00:00.000Z',
          meta: {
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        }}
        metadata={{
          accountId: 'account-1',
          accountOrgId: 'org-1',
          profileId: 'profile-1',
          profileOrgId: 'org-1',
          profileAccountId: 'account-1',
          authUserId: null,
          managerStaffId: null,
          childProfileIds: ['child-profile-1'],
          childAccountIds: ['child-account-1'],
          notificationScopeIds: ['scope-1'],
          familyInviteIds: ['invite-1'],
          familyInviteFamilyIds: ['family-1'],
          familyInviteAcceptedByAccountIds: ['accepted-account-1'],
          familyInviteCreatedByAccountIds: ['created-account-1'],
        }}
      />,
    );

    const metadataTab = screen.getByRole('tab', { name: /metadata/i });
    fireEvent.mouseDown(metadataTab);
    fireEvent.click(metadataTab);

    await waitFor(() => {
      expect(screen.getByText('Account UUID')).toBeInTheDocument();
    });
    expect(screen.getAllByText('account-1').length).toBeGreaterThan(0);
    expect(screen.getByText('child-profile-1')).toBeInTheDocument();
    expect(screen.getByText('family-1')).toBeInTheDocument();
  });

  it('uses a constrained scrollable tab panel layout', () => {
    render(
      <AdminUserProfilePreviewDialog
        open
        onOpenChange={() => undefined}
        account={{
          ids: { id: 'account-1', orgId: 'org-1' },
          contacts: { email: 'jamie@example.com' },
          lifecycle: {
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        }}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveClass('max-h-[90vh]', 'overflow-hidden');
    expect(screen.getByTestId('scroll-shell-account')).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
      'flex-1',
    );
  });
});
