import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';
import { RolesManagementDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/roles/roles-management-dashboard';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Roles & Policies',
  description:
    'Assign and remove user role records to control persona availability and access.',
};

export default async function AdminRolesSettingsPage({
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
      <DashboardHeader title="Roles & policies" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Roles &amp; Policies
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assign roles and configure access policies for organisation members.
            </p>
          </div>
        </div>
        <RolesManagementDashboard orgId={org.id} />
      </div>
    </div>
  );
}
