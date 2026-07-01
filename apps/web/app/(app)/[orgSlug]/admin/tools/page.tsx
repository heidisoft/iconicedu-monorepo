import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { EdgeFunctionsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/tools/edge-functions-dashboard';
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
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Tools" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Developer Tools</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manually trigger edge functions and background workers for testing.
            </p>
          </div>
        </div>
        <EdgeFunctionsDashboard orgId={org.id} />
      </div>
    </div>
  );
}
