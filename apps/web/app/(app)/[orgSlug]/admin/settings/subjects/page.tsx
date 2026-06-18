import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';
import { SubjectCatalogSettingsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/subjects/subject-catalog-settings-dashboard';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Subjects',
  description: 'Manage the subject catalog used across classrooms and subject pickers.',
};

export default async function AdminSubjectCatalogSettingsPage({
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
      <DashboardHeader title="Subjects" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Subject Catalogue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enable or disable subjects available to classrooms in this organisation.
            </p>
          </div>
        </div>
        <SubjectCatalogSettingsDashboard orgId={org.id} />
      </div>
    </div>
  );
}
