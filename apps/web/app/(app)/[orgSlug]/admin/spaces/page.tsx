import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminLearningSpaceRows } from '@iconicedu/web/lib/admin/learning-spaces';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { LearningSpacesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-spaces-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Classrooms',
  description: 'Review and manage classrooms, subjects, and visibility settings.',
};

export default async function AdminLearningSpacesPage({
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

  const rows = await getAdminLearningSpaceRows(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Classrooms" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <LearningSpacesDashboard rows={rows} />
      </div>
    </div>
  );
}
