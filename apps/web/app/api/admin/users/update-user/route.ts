import { NextResponse } from 'next/server';
import type { AccountRoleStatus, RoleKey } from '@iconicedu/shared-types';

import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';
import { upsertUserRole } from '@iconicedu/web/lib/profile/queries/roles.query';

type UpdateUserRequestBody = {
  accountId?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  primaryRole?: string;
  roleStatus?: string;
};

const normalizeNullableField = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const ALLOWED_PRIMARY_ROLES: RoleKey[] = [
  'owner',
  'admin',
  'educator',
  'guardian',
  'child',
  'staff',
];
const ALLOWED_ROLE_STATUSES: AccountRoleStatus[] = [
  'unassigned',
  'active',
  'pending',
  'blocked',
];

const normalizePrimaryRole = (value?: string): RoleKey | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'unassigned') {
    return null;
  }
  return ALLOWED_PRIMARY_ROLES.includes(normalized as RoleKey)
    ? (normalized as RoleKey)
    : null;
};

const normalizeRoleStatus = (value?: string): AccountRoleStatus => {
  const normalized = value?.trim().toLowerCase();
  return ALLOWED_ROLE_STATUSES.includes(normalized as AccountRoleStatus)
    ? (normalized as AccountRoleStatus)
    : 'unassigned';
};

export async function POST(request: Request) {
  const body = (await request.json()) as UpdateUserRequestBody;
  const accountId = body.accountId?.trim();
  const normalizedEmail = body.email?.trim().toLowerCase() ?? '';
  const normalizedDisplayName = normalizeNullableField(body.displayName);
  const normalizedFirstName = normalizeNullableField(body.firstName);
  const normalizedLastName = normalizeNullableField(body.lastName);
  const normalizedPrimaryRole = normalizePrimaryRole(body.primaryRole);
  const normalizedRoleStatus = normalizeRoleStatus(body.roleStatus);

  if (!accountId) {
    return NextResponse.json(
      { success: false, message: 'accountId is required' },
      { status: 400 },
    );
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return NextResponse.json(
      { success: false, message: 'Valid email is required' },
      { status: 400 },
    );
  }

  const adminClient = getFamilyInviteAdminClient();
  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .select('id, org_id, auth_user_id, email')
    .eq('id', accountId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{
      id: string;
      org_id: string;
      auth_user_id?: string | null;
      email?: string | null;
    }>();

  if (accountError) {
    return NextResponse.json(
      { success: false, message: accountError.message },
      { status: 500 },
    );
  }

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const { data: conflictingAccount, error: conflictError } = await adminClient
    .from('accounts')
    .select('id')
    .eq('org_id', account.org_id)
    .ilike('email', normalizedEmail)
    .neq('id', account.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (conflictError) {
    return NextResponse.json(
      { success: false, message: conflictError.message },
      { status: 500 },
    );
  }

  if (conflictingAccount) {
    return NextResponse.json(
      { success: false, message: 'Email is already used by another account' },
      { status: 409 },
    );
  }

  const { error: accountUpdateError } = await adminClient
    .from('accounts')
    .update({
      email: normalizedEmail,
      primary_role: normalizedPrimaryRole,
      role_status: normalizedRoleStatus,
    })
    .eq('id', account.id)
    .eq('org_id', account.org_id);

  if (accountUpdateError) {
    return NextResponse.json(
      { success: false, message: accountUpdateError.message },
      { status: 500 },
    );
  }

  if (account.auth_user_id && account.email?.toLowerCase() !== normalizedEmail) {
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      account.auth_user_id,
      { email: normalizedEmail },
    );
    if (authUpdateError) {
      return NextResponse.json(
        { success: false, message: authUpdateError.message },
        { status: 500 },
      );
    }
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({
      display_name: normalizedDisplayName,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
    })
    .eq('account_id', account.id)
    .eq('org_id', account.org_id)
    .is('deleted_at', null);

  if (profileUpdateError) {
    return NextResponse.json(
      { success: false, message: profileUpdateError.message },
      { status: 500 },
    );
  }

  if (normalizedPrimaryRole && normalizedRoleStatus === 'active') {
    const roleResponse = await upsertUserRole(adminClient, {
      orgId: account.org_id,
      accountId: account.id,
      roleKey: normalizedPrimaryRole,
      assignedBy: account.auth_user_id ?? null,
    });
    if (roleResponse.error) {
      return NextResponse.json(
        { success: false, message: roleResponse.error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
