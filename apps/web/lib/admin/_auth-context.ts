import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type AdminAuthContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  orgId: string;
  profileId: string;
  now: string;
};

export async function requireAdminAuthContext(): Promise<AdminAuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  return {
    supabase,
    orgId: accountResponse.data.org_id,
    profileId: profileResponse.data.id,
    now: new Date().toISOString(),
  };
}
