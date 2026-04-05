import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import type { AccountRow, UserRoleRow } from '@iconicedu/shared-types';

function makeAccount(overrides?: Partial<AccountRow>): AccountRow {
  return {
    id: 'account-1',
    org_id: 'org-1',
    auth_user_id: 'auth-1',
    email: 'iconicedudev+test@gmail.com',
    status: 'active',
    role_status: 'unassigned',
    primary_role: null,
    onboarding_completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRole(roleKey: UserRoleRow['role_key']): UserRoleRow {
  const now = new Date().toISOString();
  return {
    id: `role-${roleKey}`,
    org_id: 'org-1',
    account_id: 'account-1',
    role_key: roleKey,
    assigned_at: now,
    created_at: now,
    updated_at: now,
  };
}

describe('buildAuthOnboardingState', () => {
  it('requires role selection when no role is assigned', () => {
    const state = buildAuthOnboardingState(makeAccount(), []);

    expect(state.requiresRoleSelection).toBe(true);
    expect(state.destination).toBeNull();
  });

  it('routes active users to dashboard', () => {
    const now = new Date().toISOString();
    const state = buildAuthOnboardingState(
      makeAccount({
        primary_role: 'guardian',
        role_status: 'active',
        onboarding_completed_at: now,
      }),
      [makeRole('guardian')],
    );

    expect(state.requiresRoleSelection).toBe(false);
    expect(state.destination).toBe('/dashboard');
  });

  it('routes pending users to pending access page', () => {
    const now = new Date().toISOString();
    const state = buildAuthOnboardingState(
      makeAccount({
        primary_role: 'educator',
        role_status: 'pending',
        onboarding_completed_at: now,
      }),
      [],
    );

    expect(state.requiresRoleSelection).toBe(false);
    expect(state.destination).toBe('/login/pending-access');
  });
});
