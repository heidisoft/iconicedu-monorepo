import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RolesManagementDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/roles/roles-management-dashboard';

describe('RolesManagementDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders users from API and supports search filtering', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            {
              accountId: 'account-1',
              email: 'taylor@example.com',
              displayName: 'Taylor Parent',
              profileKind: 'guardian',
              roles: ['guardian'],
            },
            {
              accountId: 'account-2',
              email: 'sam@example.com',
              displayName: 'Sam Tutor',
              profileKind: 'educator',
              roles: ['educator'],
            },
          ],
        },
      }),
    } as Response);

    const user = userEvent.setup();
    render(<RolesManagementDashboard orgId="org-1" />);

    expect(await screen.findByText('User selector')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Taylor Parent/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Sam Tutor/i })).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Search users by name, email, or profile kind'),
      'sam',
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: /Taylor Parent/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: /Sam Tutor/i })).toBeInTheDocument();
  });

  it('assigns role and reloads data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            users: [
              {
                accountId: 'account-1',
                email: 'taylor@example.com',
                displayName: 'Taylor Parent',
                profileKind: 'guardian',
                roles: ['guardian'],
              },
            ],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            users: [
              {
                accountId: 'account-1',
                email: 'taylor@example.com',
                displayName: 'Taylor Parent',
                profileKind: 'guardian',
                roles: ['guardian', 'educator'],
              },
            ],
          },
        }),
      } as Response);

    const user = userEvent.setup();
    render(<RolesManagementDashboard orgId="org-1" />);

    await screen.findByRole('button', { name: 'Assign role' });

    await user.selectOptions(screen.getByLabelText('Role'), 'educator');
    await user.click(screen.getByRole('button', { name: 'Assign role' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          accountId: 'account-1',
          roleKey: 'educator',
        }),
      });
    });

    expect(await screen.findByLabelText('Remove Tutor role')).toBeInTheDocument();
  });

  it('shows remove action for non-protected roles only', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            {
              accountId: 'account-1',
              email: 'admin@example.com',
              displayName: 'Org Admin',
              profileKind: 'staff',
              roles: ['admin', 'staff'],
            },
          ],
        },
      }),
    } as Response);

    render(<RolesManagementDashboard orgId="org-1" />);

    await screen.findByText('Current roles');
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Remove Admin role')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Remove Staff role')).toBeInTheDocument();
  });
});
