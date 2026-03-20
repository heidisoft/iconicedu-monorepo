import {
  ParentModeRequiredError,
  requireEffectiveActorContext,
} from '@iconicedu/web/lib/family-view/actor-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type AdminAuthContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  accountId: string;
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

  const actor = await requireEffectiveActorContext(supabase);
  if (actor.isViewingAsChild) {
    throw new ParentModeRequiredError();
  }

  return {
    supabase,
    accountId: actor.account.id,
    orgId: actor.account.org_id,
    profileId: actor.profile.id,
    now: new Date().toISOString(),
  };
}
