/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import {
  getProfileByAccountId,
  insertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';

const basePayload = {
  orgId: 'org-1',
  accountId: 'account-1',
  kind: 'guardian',
  displayName: 'Test User',
  avatarSource: 'seed',
  avatarUrl: null,
  avatarSeed: 'seed-1',
  timezone: 'UTC',
  locale: 'en-US',
  status: 'active',
  uiThemeKey: 'teal',
} as const;

describe('insertProfileForAccount', () => {
  it('uses upsert with org/account/kind conflict target', async () => {
    const expected = {
      data: { id: 'profile-1', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    };

    const upsertSingle = vi.fn().mockResolvedValue(expected);
    const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
    const upsert = vi.fn(() => ({ select: upsertSelect }));

    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as any;

    const result = await insertProfileForAccount(supabase, basePayload);

    expect(result).toEqual(expected);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        account_id: 'account-1',
        kind: 'guardian',
      }),
      { onConflict: 'org_id,account_id,kind' },
    );
  });

  it('falls back to insert when upsert cannot target conflict columns', async () => {
    const upsertError = { code: '42P10', message: 'no unique constraint' };
    const fallback = {
      data: { id: 'profile-1', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    };

    const upsertSingle = vi.fn().mockResolvedValue({ data: null, error: upsertError });
    const insertSingle = vi.fn().mockResolvedValue(fallback);

    const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const upsert = vi.fn(() => ({ select: upsertSelect }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    const from = vi.fn(() => ({ upsert, insert }));
    const supabase = { from } as any;

    const result = await insertProfileForAccount(supabase, basePayload);

    expect(result).toEqual(fallback);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe('getProfileByAccountId', () => {
  function createQueryBuilder(result: unknown) {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue(result);

    return builder;
  }

  it('returns active profile when accounts.active_profile_id is valid', async () => {
    const accountBuilder = createQueryBuilder({
      data: { id: 'account-1', org_id: 'org-1', active_profile_id: 'profile-active' },
      error: null,
    });
    const activeProfileBuilder = createQueryBuilder({
      data: { id: 'profile-active', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'accounts') {
        return accountBuilder;
      }
      return activeProfileBuilder;
    });
    const supabase = { from } as any;

    const response = await getProfileByAccountId(supabase, 'account-1');

    expect(response.data).toEqual({
      id: 'profile-active',
      org_id: 'org-1',
      account_id: 'account-1',
    });
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('id', 'profile-active');
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(activeProfileBuilder.order).not.toHaveBeenCalled();
  });

  it('falls back to latest profile when active_profile_id is null', async () => {
    const accountBuilder = createQueryBuilder({
      data: { id: 'account-1', org_id: 'org-1', active_profile_id: null },
      error: null,
    });
    const fallbackProfileBuilder = createQueryBuilder({
      data: { id: 'profile-newest', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'accounts') {
        return accountBuilder;
      }
      return fallbackProfileBuilder;
    });
    const supabase = { from } as any;

    const response = await getProfileByAccountId(supabase, 'account-1');

    expect(response.data).toEqual({
      id: 'profile-newest',
      org_id: 'org-1',
      account_id: 'account-1',
    });
    expect(fallbackProfileBuilder.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(fallbackProfileBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(fallbackProfileBuilder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(fallbackProfileBuilder.limit).toHaveBeenCalledWith(1);
  });

  it('falls back to latest profile when active profile is missing or soft-deleted', async () => {
    const accountBuilder = createQueryBuilder({
      data: { id: 'account-1', org_id: 'org-1', active_profile_id: 'profile-stale' },
      error: null,
    });
    const activeProfileBuilder = createQueryBuilder({
      data: null,
      error: null,
    });
    const fallbackProfileBuilder = createQueryBuilder({
      data: { id: 'profile-newest', org_id: 'org-1', account_id: 'account-1' },
      error: null,
    });
    const profileBuilders = [activeProfileBuilder, fallbackProfileBuilder];
    const from = vi.fn((table: string) => {
      if (table === 'accounts') {
        return accountBuilder;
      }
      return profileBuilders.shift();
    });
    const supabase = { from } as any;

    const response = await getProfileByAccountId(supabase, 'account-1');

    expect(response.data).toEqual({
      id: 'profile-newest',
      org_id: 'org-1',
      account_id: 'account-1',
    });
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('id', 'profile-stale');
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(activeProfileBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(fallbackProfileBuilder.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(fallbackProfileBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});
