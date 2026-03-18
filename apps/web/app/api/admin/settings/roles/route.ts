import { NextResponse } from 'next/server';
import type { RoleKey } from '@iconicedu/shared-types';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import {
  listUserRolesByOrgId,
  softDeleteUserRole,
  upsertUserRole,
} from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type RoleManagementUserVM = {
  accountId: string;
  email: string | null;
  displayName: string;
  profileKind: string | null;
  roles: RoleKey[];
};

type RoleMutationBody = {
  orgId?: string;
  accountId?: string;
  roleKey?: string;
};

const ALLOWED_ROLE_KEYS: RoleKey[] = [
  'owner',
  'admin',
  'educator',
  'guardian',
  'child',
  'staff',
];

function normalizeRoleKey(value?: string): RoleKey | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return ALLOWED_ROLE_KEYS.includes(normalized as RoleKey)
    ? (normalized as RoleKey)
    : null;
}

function buildDisplayName(input: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) {
  const displayName = input.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const first = input.firstName?.trim() ?? '';
  const last = input.lastName?.trim() ?? '';
  if (first && last) {
    return `${first} ${last}`;
  }
  if (first) {
    return first;
  }
  return input.email?.trim() || 'Unknown user';
}

async function listRoleManagementUsers(orgId: string) {
  const supabase = createSupabaseServiceClient();
  const [accountsResponse, profilesResponse, rolesResponse] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, email, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<Array<{ id: string; email: string | null; created_at: string }>>(),
    supabase
      .from('profiles')
      .select('id, account_id, kind, display_name, first_name, last_name, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<
        Array<{
          id: string;
          account_id: string;
          kind: string | null;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
        }>
      >(),
    listUserRolesByOrgId(supabase, orgId),
  ]);

  if (accountsResponse.error) {
    return { error: accountsResponse.error.message };
  }
  if (profilesResponse.error) {
    return { error: profilesResponse.error.message };
  }
  if (rolesResponse.error) {
    return { error: rolesResponse.error.message };
  }

  const latestProfileByAccountId = new Map<
    string,
    {
      id: string;
      account_id: string;
      kind: string | null;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      created_at: string;
    }
  >();
  (profilesResponse.data ?? []).forEach((profile) => {
    const existing = latestProfileByAccountId.get(profile.account_id);
    if (!existing || existing.created_at < profile.created_at) {
      latestProfileByAccountId.set(profile.account_id, profile);
    }
  });

  const rolesByAccountId = new Map<string, Set<RoleKey>>();
  (rolesResponse.data ?? []).forEach((role) => {
    const accountRoles = rolesByAccountId.get(role.account_id) ?? new Set<RoleKey>();
    accountRoles.add(role.role_key);
    rolesByAccountId.set(role.account_id, accountRoles);
  });

  const users: RoleManagementUserVM[] = (accountsResponse.data ?? []).map((account) => {
    const profile = latestProfileByAccountId.get(account.id);
    return {
      accountId: account.id,
      email: account.email ?? null,
      displayName: buildDisplayName({
        displayName: profile?.display_name ?? null,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        email: account.email ?? null,
      }),
      profileKind: profile?.kind ?? null,
      roles: Array.from(rolesByAccountId.get(account.id) ?? []).sort(),
    };
  });

  users.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { data: users };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId')?.trim();

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  const authContext = await requireAdminOrgContext(orgId);
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  const usersResponse = await listRoleManagementUsers(orgId);
  if (usersResponse.error) {
    return NextResponse.json(
      { success: false, message: usersResponse.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { users: usersResponse.data } });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as RoleMutationBody;
  const orgId = payload.orgId?.trim();
  const accountId = payload.accountId?.trim();
  const roleKey = normalizeRoleKey(payload.roleKey);

  if (!orgId || !accountId || !roleKey) {
    return NextResponse.json(
      { success: false, message: 'orgId, accountId and valid roleKey are required' },
      { status: 400 },
    );
  }

  const authContext = await requireAdminOrgContext(orgId);
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  const supabase = createSupabaseServiceClient();
  const assignResponse = await upsertUserRole(supabase, {
    orgId,
    accountId,
    roleKey,
    assignedBy: authContext.actorProfileId ?? null,
  });
  if (assignResponse.error) {
    return NextResponse.json(
      { success: false, message: assignResponse.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const payload = (await request.json()) as RoleMutationBody;
  const orgId = payload.orgId?.trim();
  const accountId = payload.accountId?.trim();
  const roleKey = normalizeRoleKey(payload.roleKey);

  if (!orgId || !accountId || !roleKey) {
    return NextResponse.json(
      { success: false, message: 'orgId, accountId and valid roleKey are required' },
      { status: 400 },
    );
  }

  if (roleKey === 'owner' || roleKey === 'admin') {
    return NextResponse.json(
      { success: false, message: 'Removing owner or admin roles is not allowed.' },
      { status: 403 },
    );
  }

  const authContext = await requireAdminOrgContext(orgId);
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  const supabase = createSupabaseServiceClient();
  const removeResponse = await softDeleteUserRole(supabase, {
    orgId,
    accountId,
    roleKey,
    deletedBy: authContext.actorProfileId ?? null,
  });
  if (removeResponse.error) {
    return NextResponse.json(
      { success: false, message: removeResponse.error.message },
      { status: 500 },
    );
  }
  if (!removeResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Role assignment not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
