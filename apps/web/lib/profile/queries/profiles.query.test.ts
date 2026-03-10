/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import { insertProfileForAccount } from '@iconicedu/web/lib/profile/queries/profiles.query';

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
  it('uses upsert with org/account conflict target', async () => {
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
      { onConflict: 'org_id,account_id' },
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
