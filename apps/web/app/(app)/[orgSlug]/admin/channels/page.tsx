import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Channels',
  description: 'Review and manage all channels across the organization.',
};

export default async function AdminChannelsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Channels" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <ChannelsDashboard orgSlug={orgSlug} />
      </div>
    </div>
  );
}
