import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

type ProfileActorRow = Pick<ProfileRow, 'id' | 'org_id' | 'account_id'>;

export async function canAccessProfileAsActor(input: {
  sessionSupabase: ReturnType<typeof createSupabaseSessionClient>;
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  profile: ProfileActorRow;
}): Promise<boolean> {
  if (!input.profile.account_id) return false;

  const { data: authUser, error: authError } = await input.sessionSupabase.auth.getUser();
  if (authError) throw new InternalServerErrorException(authError.message);

  const authUserId = authUser?.user?.id;
  if (!authUserId) return false;

  const { data: account, error: accountError } = await input.serviceSupabase
    .from('accounts')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();
  if (accountError) throw new InternalServerErrorException(accountError.message);
  if (!account) return false;

  if (account.id === input.profile.account_id) return true;

  const { data: familyLink, error: familyLinkError } = await input.serviceSupabase
    .from('family_links')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('guardian_account_id', account.id)
    .eq('child_account_id', input.profile.account_id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();
  if (familyLinkError) throw new InternalServerErrorException(familyLinkError.message);

  return Boolean(familyLink);
}

/**
 * Resolves the profile and account rows for `profileId` and verifies the
 * authenticated user (from `sessionSupabase`'s bearer token) may act as it —
 * either directly, or as a guardian of a linked child account. Throws rather
 * than returning a boolean, since callers need the loaded rows to proceed.
 */
export async function loadAndAuthorizeProfile(input: {
  sessionSupabase: ReturnType<typeof createSupabaseSessionClient>;
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  profileId: string;
}): Promise<{ profile: ProfileRow; account: Pick<AccountRow, 'id' | 'org_id'> }> {
  const { data: authUser, error: authError } = await input.sessionSupabase.auth.getUser();
  if (authError) throw new InternalServerErrorException(authError.message);
  if (!authUser?.user?.id) {
    throw new ForbiddenException('Unauthorized');
  }

  const profileResponse = await input.serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', input.profileId)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .maybeSingle<ProfileRow>();
  if (profileResponse.error) {
    throw new InternalServerErrorException(profileResponse.error.message);
  }
  if (!profileResponse.data) {
    throw new ForbiddenException('Unauthorized');
  }

  const canAct = await canAccessProfileAsActor({
    sessionSupabase: input.sessionSupabase,
    serviceSupabase: input.serviceSupabase,
    orgId: input.orgId,
    profile: profileResponse.data,
  });
  if (!canAct) {
    throw new ForbiddenException('Unauthorized');
  }

  return {
    profile: profileResponse.data,
    account: { id: profileResponse.data.account_id, org_id: input.orgId },
  };
}
