import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ActivityVerbSuppressionDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/activity/verb-suppression-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
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
    <AdminPageShell title="Activity controls">
      <AdminPageHeading
        title="Activity Controls"
        description="Enable or suppress specific activity verb types for this organisation."
      />
      <ActivityVerbSuppressionDashboard orgId={org.id} />
    </AdminPageShell>
  );
}
