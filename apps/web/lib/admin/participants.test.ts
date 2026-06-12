import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AccountRow, FamilyLinkRow, ProfileRow } from '@iconicedu/shared-types';

const mocks = vi.hoisted(() => ({
  serviceClient: { from: vi.fn() },
  createSupabaseServiceClient: vi.fn(),
  getAccountsByOrgId: vi.fn(),
  getProfilesByAccountIds: vi.fn(),
  getProfilesByKind: vi.fn(),
  getFamilyLinksByOrg: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountsByOrgId: mocks.getAccountsByOrgId,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByAccountIds: mocks.getProfilesByAccountIds,
  getProfilesByKind: mocks.getProfilesByKind,
}));

vi.mock('@iconicedu/web/lib/family/queries/families.query', () => ({
  getFamilyLinksByOrg: mocks.getFamilyLinksByOrg,
}));

import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';

function account(input: Partial<AccountRow> & Pick<AccountRow, 'id'>): AccountRow {
  return {
    id: input.id,
    org_id: input.org_id ?? 'org-1',
    auth_user_id: input.auth_user_id ?? null,
    email: input.email ?? null,
    preferred_contact_channels: input.preferred_contact_channels ?? [],
    status: input.status ?? 'active',
    primary_role: input.primary_role ?? null,
    role_status: input.role_status ?? 'active',
    active_profile_id: input.active_profile_id ?? null,
    onboarding_completed_at: input.onboarding_completed_at ?? null,
    created_at: input.created_at ?? '2030-01-01T00:00:00.000Z',
    created_by: input.created_by ?? null,
    updated_at: input.updated_at ?? '2030-01-01T00:00:00.000Z',
    updated_by: input.updated_by ?? null,
    deleted_at: input.deleted_at ?? null,
    deleted_by: input.deleted_by ?? null,
  };
}

function profile(
  input: Partial<ProfileRow> & Pick<ProfileRow, 'id' | 'account_id'>,
): ProfileRow {
  return {
    id: input.id,
    org_id: input.org_id ?? 'org-1',
    account_id: input.account_id,
    kind: input.kind ?? 'child',
    display_name: input.display_name ?? null,
    first_name: input.first_name ?? null,
    last_name: input.last_name ?? null,
    bio: input.bio ?? null,
    avatar_source: input.avatar_source ?? 'seed',
    avatar_url: input.avatar_url ?? null,
    avatar_seed: input.avatar_seed ?? input.id,
    avatar_updated_at: input.avatar_updated_at ?? null,
    timezone: input.timezone ?? 'UTC',
    locale: input.locale ?? 'en-US',
    languages_spoken: input.languages_spoken ?? [],
    status: input.status ?? 'active',
    country_code: input.country_code ?? null,
    country_name: input.country_name ?? null,
    region: input.region ?? null,
    city: input.city ?? null,
    postal_code: input.postal_code ?? null,
    ui_theme_key: input.ui_theme_key ?? 'teal',
    created_at: input.created_at ?? '2030-01-01T00:00:00.000Z',
    updated_at: input.updated_at ?? '2030-01-01T00:00:00.000Z',
    deleted_at: input.deleted_at ?? null,
    deleted_by: input.deleted_by ?? null,
  } as ProfileRow;
}

describe('getActiveParticipantProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServiceClient.mockReturnValue(mocks.serviceClient);
  });

  it('loads the full active org roster with the service client', async () => {
    const accounts = [
      account({ id: 'account-child', email: 'child@example.com' }),
      account({ id: 'account-guardian', email: 'guardian@example.com' }),
      account({ id: 'account-educator', email: 'teacher@example.com' }),
      account({ id: 'account-staff', email: 'staff@example.com' }),
    ];
    const profiles = [
      profile({
        id: 'profile-child',
        account_id: 'account-child',
        kind: 'child',
        display_name: 'Nia Student',
      }),
      profile({
        id: 'profile-guardian',
        account_id: 'account-guardian',
        kind: 'guardian',
        display_name: 'Maya Guardian',
      }),
      profile({
        id: 'profile-educator',
        account_id: 'account-educator',
        kind: 'educator',
        display_name: 'Mr Rivera',
      }),
      profile({
        id: 'profile-staff',
        account_id: 'account-staff',
        kind: 'staff',
        display_name: 'Admin Staff',
      }),
    ];
    const familyLinks = [
      {
        org_id: 'org-1',
        guardian_account_id: 'account-guardian',
        child_account_id: 'account-child',
      },
    ] as FamilyLinkRow[];

    mocks.getAccountsByOrgId.mockResolvedValue({ data: accounts });
    mocks.getProfilesByAccountIds.mockResolvedValue({ data: profiles });
    mocks.getProfilesByKind.mockResolvedValue({ data: [profiles[1]] });
    mocks.getFamilyLinksByOrg.mockResolvedValue({ data: familyLinks });

    const result = await getActiveParticipantProfiles('org-1');

    expect(mocks.createSupabaseServiceClient).toHaveBeenCalledTimes(1);
    expect(mocks.getAccountsByOrgId).toHaveBeenCalledWith(mocks.serviceClient, 'org-1', {
      status: 'active',
    });
    expect(result.map((item) => item.ids.id)).toEqual([
      'profile-child',
      'profile-guardian',
      'profile-educator',
      'profile-staff',
    ]);
    expect(result[0]).toMatchObject({
      kind: 'child',
      guardianNames: ['Maya Guardian'],
    });
  });
});
