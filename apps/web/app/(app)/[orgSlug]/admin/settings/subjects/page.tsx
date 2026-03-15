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
      <DashboardHeader
        title="Subjects"
        description="Manage the subject catalog used in classrooms, educator settings, and class requests."
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <SubjectCatalogSettingsDashboard orgId={org.id} />
      </div>
    </div>
  );
}
