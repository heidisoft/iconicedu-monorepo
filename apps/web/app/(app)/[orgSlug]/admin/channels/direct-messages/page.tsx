import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminDirectMessageRows } from '@iconicedu/web/lib/admin/channels';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Direct Messages',
  description: 'Review and manage all direct message channels across the organization.',
};

export default async function AdminDirectMessagesPage({
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

  const rows = await getAdminDirectMessageRows(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Direct Messages" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <ChannelsDashboard rows={rows} />
      </div>
    </div>
  );
}
