import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EdgeFunctionsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/tools/edge-functions-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Tools',
  description: 'Manually trigger edge functions and background workers for testing.',
};

export default async function AdminToolsPage({
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
    <AdminPageShell title="Tools">
      <AdminPageHeading
        title="Developer Tools"
        description="Manually trigger edge functions and background workers for testing."
      />
      <EdgeFunctionsDashboard orgId={org.id} />
    </AdminPageShell>
  );
}
