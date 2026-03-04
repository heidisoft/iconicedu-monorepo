import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setEntityStatus } from '@iconicedu/web/lib/admin/entity-status';

const update = vi.fn();
const eq = vi.fn();
const is = vi.fn();
const requireAdminAuthContext = vi.fn();

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: (...args: unknown[]) => requireAdminAuthContext(...args),
}));

describe('setEntityStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    is.mockResolvedValue({ error: null });
    eq.mockReturnValue({ eq, is });
    update.mockReturnValue({ eq, is });
    requireAdminAuthContext.mockResolvedValue({
      supabase: {
        from: vi.fn(() => ({
          update,
        })),
      },
      orgId: 'org-1',
      profileId: 'profile-1',
      now: '2026-03-04T00:00:00.000Z',
    });
  });

  it('archives an entity with archived timestamp', async () => {
    await setEntityStatus('channels', 'channel-1', 'archived');

    expect(update).toHaveBeenCalledWith({
      status: 'archived',
      archived_at: '2026-03-04T00:00:00.000Z',
      updated_at: '2026-03-04T00:00:00.000Z',
      updated_by: 'profile-1',
    });
  });

  it('unarchives an entity by clearing archived_at', async () => {
    await setEntityStatus('learning_spaces', 'space-1', 'active');

    expect(update).toHaveBeenCalledWith({
      status: 'active',
      archived_at: null,
      updated_at: '2026-03-04T00:00:00.000Z',
      updated_by: 'profile-1',
    });
  });
});
