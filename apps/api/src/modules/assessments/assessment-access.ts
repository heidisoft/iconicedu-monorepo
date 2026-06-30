import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const MANAGER_ROLES = new Set(['owner', 'admin', 'staff']);

type AccountRow = {
  id: string;
  org_id: string;
  primary_role: string | null;
  active_profile_id: string | null;
};

export type AssessmentActor = {
  accountId: string;
  orgId: string;
  profileId: string | null;
  role: string | null;
};

function requireOrgId(orgId: string | undefined | null): string {
  if (!orgId) {
    throw new BadRequestException('Missing organization id');
  }
  return orgId;
}

export async function requireAssessmentOrgManager(
  accountId: string,
  orgIdInput: string | undefined | null,
): Promise<AssessmentActor> {
  const orgId = requireOrgId(orgIdInput);
  const supabase = createSupabaseServiceClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, primary_role, active_profile_id')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .maybeSingle<AccountRow>();

  if (accountError) throw new BadRequestException(accountError.message);
  if (!account)
    throw new ForbiddenException('You do not have access to this organization');

  if (account.primary_role && MANAGER_ROLES.has(account.primary_role)) {
    return {
      accountId,
      orgId,
      profileId: account.active_profile_id,
      role: account.primary_role,
    };
  }

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role_key')
    .eq('account_id', accountId)
    .eq('org_id', orgId)
    .in('role_key', Array.from(MANAGER_ROLES))
    .maybeSingle<{ role_key: string | null }>();

  if (roleError) throw new BadRequestException(roleError.message);
  if (!role?.role_key) {
    throw new ForbiddenException('Assessment management requires an org staff role');
  }

  return {
    accountId,
    orgId,
    profileId: account.active_profile_id,
    role: role.role_key,
  };
}

export async function resolveAssessmentActorProfile(
  accountId: string,
  orgIdInput: string | undefined | null,
): Promise<AssessmentActor> {
  const orgId = requireOrgId(orgIdInput);
  const supabase = createSupabaseServiceClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, primary_role, active_profile_id')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .maybeSingle<AccountRow>();

  if (accountError) throw new BadRequestException(accountError.message);
  if (!account) throw new ForbiddenException('You do not have access to this delivery');

  if (account.active_profile_id) {
    const { data: activeProfile, error: activeProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', account.active_profile_id)
      .eq('account_id', accountId)
      .eq('org_id', orgId)
      .maybeSingle<{ id: string }>();

    if (activeProfileError) throw new BadRequestException(activeProfileError.message);
    if (activeProfile) {
      return {
        accountId,
        orgId,
        profileId: activeProfile.id,
        role: account.primary_role,
      };
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('account_id', accountId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (profileError) throw new BadRequestException(profileError.message);
  if (!profile) throw new NotFoundException('Profile not found for this organization');

  return {
    accountId,
    orgId,
    profileId: profile.id,
    role: account.primary_role,
  };
}
