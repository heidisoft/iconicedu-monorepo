import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';
import { listSelfServePoliciesAction } from '@iconicedu/web/app/actions/self-serve-class-session-change';
import { SessionChangePolicyDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/session-changes/session-change-policy-dashboard';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Session Changes',
  description: 'Configure self-serve cancellation and reschedule policies.',
};

export default async function AdminSessionChangeSettingsPage({
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

  const policies = await listSelfServePoliciesAction({ orgSlug });

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Session changes" />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Session Change Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure who can cancel or reschedule classes and when approval is required.
          </p>
        </div>
        <SessionChangePolicyDashboard orgSlug={orgSlug} policies={policies} />
      </div>
    </div>
  );
}
