import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';
import { Button, DashboardHeader } from '@iconicedu/ui-web';

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
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/${orgSlug}/admin/channels`}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Channels
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Direct Messages</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View direct message channels between organisation members.
            </p>
          </div>
        </div>
        <ChannelsDashboard rows={rows} />
      </div>
    </div>
  );
}
