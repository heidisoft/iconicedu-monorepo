import type { AccountRow, UserRoleRow } from '@iconicedu/shared-types';

type AuthOnboardingDestination = '/d' | '/login/pending-access';

export interface AuthOnboardingState {
  primaryRole: AccountRow['primary_role'] | null;
  roleStatus: NonNullable<AccountRow['role_status']>;
  onboardingCompletedAt: string | null;
  requiresRoleSelection: boolean;
  destination: AuthOnboardingDestination | null;
}

function normalizeRoleStatus(
  value: AccountRow['role_status'] | undefined | null,
): NonNullable<AccountRow['role_status']> {
  if (value === 'active' || value === 'pending' || value === 'blocked') {
    return value;
  }
  return 'unassigned';
}

export function buildAuthOnboardingState(
  account: AccountRow,
  roleRows: UserRoleRow[],
): AuthOnboardingState {
  const primaryRole = account.primary_role ?? null;
  const roleStatus = normalizeRoleStatus(account.role_status);
  const onboardingCompletedAt = account.onboarding_completed_at ?? null;
  const hasAnyRole =
    roleRows.length > 0 ||
    primaryRole === 'guardian' ||
    primaryRole === 'educator' ||
    primaryRole === 'child' ||
    primaryRole === 'staff' ||
    primaryRole === 'admin' ||
    primaryRole === 'owner';

  const requiresRoleSelection =
    !hasAnyRole || !primaryRole || !onboardingCompletedAt || roleStatus === 'unassigned';

  if (requiresRoleSelection) {
    return {
      primaryRole,
      roleStatus,
      onboardingCompletedAt,
      requiresRoleSelection: true,
      destination: null,
    };
  }

  if (roleStatus === 'pending' || roleStatus === 'blocked') {
    return {
      primaryRole,
      roleStatus,
      onboardingCompletedAt,
      requiresRoleSelection: false,
      destination: '/login/pending-access',
    };
  }

  return {
    primaryRole,
    roleStatus,
    onboardingCompletedAt,
    requiresRoleSelection: false,
    destination: '/d',
  };
}
