import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';
import { AdminPageShell } from '@iconicedu/web/components/admin/admin-page-layout';

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
    <AdminPageShell title="Channels">
      <ChannelsDashboard orgSlug={orgSlug} />
    </AdminPageShell>
  );
}
