import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminChannelRows } from '@iconicedu/web/lib/admin/channels';
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

  const rows = await getAdminChannelRows(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Channels" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and manage all channels across the organisation.
            </p>
          </div>
        </div>
        <ChannelsDashboard rows={rows} />
      </div>
    </div>
  );
}
