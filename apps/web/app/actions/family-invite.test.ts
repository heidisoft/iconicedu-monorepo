import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  deleteInvite: vi.fn(),
  adminClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        maybeSingle: async () => ({
          data: { invited_email: 'child@example.invalid', status: 'pending' },
          error: null,
        }),
      };
      return query;
    },
  }),
}));
vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireParentActorContext: async () => ({ account: { id: 'parent', org_id: 'org' } }),
}));
vi.mock('@iconicedu/web/lib/family/queries/invite.query', () => ({
  acceptFamilyInvite: vi.fn(),
  createFamilyInvite: vi.fn(),
  deleteFamilyInvite: mocks.deleteInvite,
  getFamilyInviteAdminClient: mocks.adminClient,
  mapFamilyLinkInviteRowToVM: vi.fn(),
}));
import { revokeFamilyInviteAction } from './family-invite';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user' } } });
  mocks.deleteInvite.mockResolvedValue(undefined);
});
it('cancels a family invitation without deleting or looking up auth identities', async () => {
  await revokeFamilyInviteAction({ inviteId: 'invite' });
  expect(mocks.deleteInvite).toHaveBeenCalledWith(
    expect.objectContaining({
      inviteId: 'invite',
      guardianAccountId: 'parent',
      orgId: 'org',
    }),
  );
  expect(mocks.adminClient).not.toHaveBeenCalled();
});
it('rejects unauthenticated revocation before changing data', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(revokeFamilyInviteAction({ inviteId: 'invite' })).rejects.toThrow(
    'Unauthorized',
  );
  expect(mocks.deleteInvite).not.toHaveBeenCalled();
});
