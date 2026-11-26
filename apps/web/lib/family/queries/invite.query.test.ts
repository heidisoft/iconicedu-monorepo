import { expect, it, vi } from 'vitest';
import type { AccountRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(),
  upsertProfileForAccount: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/profile/queries/notification-defaults-seed.query', () => ({
  seedSignupDefaultNotificationPreferences: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/profile/constants/theme', () => ({
  pickRandomThemeKey: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByEmail: vi.fn(),
  insertInvitedAccount: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({ getOrgById: vi.fn() }));
import { acceptFamilyInvite } from './invite.query';
it('does not create a family link when an invite is revoked during acceptance', async () => {
  const maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        id: 'invite',
        org_id: 'org',
        family_id: 'family',
        created_by_account_id: 'parent',
        invited_email: 'child@example.invalid',
        invited_role: 'child',
        status: 'pending',
      },
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const from = vi.fn().mockReturnValue(query);
  await expect(
    acceptFamilyInvite({
      inviteId: 'invite',
      account: {
        id: 'child',
        org_id: 'org',
        email: 'child@example.invalid',
      } as AccountRow,
      adminClient: { from } as unknown as SupabaseClient,
    }),
  ).rejects.toThrow('Invitation is no longer available.');
  expect(from).not.toHaveBeenCalledWith('family_links');
});
