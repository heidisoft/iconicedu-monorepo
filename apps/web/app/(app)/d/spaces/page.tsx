import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { buildLearningSpaceChannelsWithMessages } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const { account } = await getOrCreateAccount(supabase, {
    orgId: ORG_ID,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });
  const dashboardPath = await resolveOrgDashboardPath(supabase, account.org_id);
  const channels = await buildLearningSpaceChannelsWithMessages(supabase, account.org_id, {
    accountId: account.id,
  });
  const firstChannel = channels[0];

  if (!firstChannel) {
    return null;
  }

  redirect(`${dashboardPath}/spaces/${firstChannel.ids.id}`);
}
