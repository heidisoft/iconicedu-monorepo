import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';
import { ActivityVerbSuppressionDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/activity/verb-suppression-dashboard';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Activity Controls',
  description:
    'Configure activity verb suppression for system-wide or actor-specific events.',
};

export default async function AdminActivityControlsPage({
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
      <DashboardHeader title="Activity controls" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activity Controls</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enable or suppress specific activity verb types for this organisation.
            </p>
          </div>
        </div>
        <ActivityVerbSuppressionDashboard orgId={org.id} />
      </div>
    </div>
  );
}
