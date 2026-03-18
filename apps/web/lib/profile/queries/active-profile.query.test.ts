/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import { resolveActiveProfileForAccountInOrg } from '@iconicedu/web/lib/profile/queries/active-profile.query';

const updateAccountActiveProfile = vi.fn();

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  updateAccountActiveProfile: (...args: unknown[]) => updateAccountActiveProfile(...args),
}));

describe('resolveActiveProfileForAccountInOrg', () => {
  it('uses active_profile_id when it matches org/account and is active', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: 'profile-active', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    }));
    const chain: any = {
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      maybeSingle,
    };
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as any;

    const result = await resolveActiveProfileForAccountInOrg(supabase, {
      accountId: 'account-1',
      orgId: 'org-1',
      activeProfileId: 'profile-active',
      updatedByAuthUserId: 'auth-user',
    });

    expect(result).toEqual({
      profile: { id: 'profile-active', org_id: 'org-1', account_id: 'account-1' },
      source: 'active_profile_id',
    });
    expect(updateAccountActiveProfile).not.toHaveBeenCalled();
  });

  it('falls back and heals accounts.active_profile_id when active profile is missing', async () => {
    updateAccountActiveProfile.mockReset();
    updateAccountActiveProfile.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    });

    const activeMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const fallbackMaybeSingle = vi.fn(async () => ({
      data: { id: 'profile-newest', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    }));
    const activeChain: any = {
      eq: vi.fn(() => activeChain),
      is: vi.fn(() => activeChain),
      maybeSingle: activeMaybeSingle,
    };
    const fallbackChain: any = {
      eq: vi.fn(() => fallbackChain),
      is: vi.fn(() => fallbackChain),
      order: vi.fn(() => fallbackChain),
      limit: vi.fn(() => fallbackChain),
      maybeSingle: fallbackMaybeSingle,
    };
    let selectCalls = 0;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => {
          selectCalls += 1;
          return selectCalls === 1 ? activeChain : fallbackChain;
        }),
      })),
    } as any;

    const result = await resolveActiveProfileForAccountInOrg(supabase, {
      accountId: 'account-1',
      orgId: 'org-1',
      activeProfileId: 'stale-profile',
      updatedByAuthUserId: 'auth-user',
    });

    expect(result).toEqual({
      profile: { id: 'profile-newest', org_id: 'org-1', account_id: 'account-1' },
      source: 'fallback-healed',
    });
    expect(updateAccountActiveProfile).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        accountId: 'account-1',
        orgId: 'org-1',
        activeProfileId: 'profile-newest',
      }),
    );
  });
});
