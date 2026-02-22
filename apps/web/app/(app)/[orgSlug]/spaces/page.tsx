import { redirect } from 'next/navigation';

import { buildLearningSpaceChannelsWithMessages } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account, dashboardPath } = await getDashboardAccountContext(orgSlug);
  const channels = await buildLearningSpaceChannelsWithMessages(supabase, account.org_id, {
    accountId: account.id,
  });
  const firstChannel = channels[0];

  if (!firstChannel) {
    return null;
  }

  redirect(`${dashboardPath}/spaces/${firstChannel.ids.id}`);
}
