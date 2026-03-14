import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteChannel } from './channel-delete';

const requireAdminAuthContext = vi.fn();
const getUserRoles = vi.fn();
const createSupabaseServiceClient = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const is = vi.fn();

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: (...args: unknown[]) => requireAdminAuthContext(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: (...args: unknown[]) => getUserRoles(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClient(...args),
}));

describe('deleteChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    is.mockResolvedValue({ error: null });
    eq.mockReturnValue({ eq, is });
    update.mockReturnValue({ eq, is });

    requireAdminAuthContext.mockResolvedValue({
      supabase: { __brand: 'authed-client' },
      accountId: 'account-1',
      orgId: 'org-1',
      profileId: 'profile-1',
      now: '2026-03-14T11:00:00.000Z',
    });

    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'staff' }],
      error: null,
    });

    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        update,
      })),
    });
  });

  it('soft deletes channels with the service client for staff managers', async () => {
    await deleteChannel('channel-1');

    expect(createSupabaseServiceClient).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      deleted_at: '2026-03-14T11:00:00.000Z',
      deleted_by: 'profile-1',
      updated_at: '2026-03-14T11:00:00.000Z',
      updated_by: 'profile-1',
    });
  });

  it('rejects users without a manager role', async () => {
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'guardian' }],
      error: null,
    });

    await expect(deleteChannel('channel-1')).rejects.toThrow('Forbidden');
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
