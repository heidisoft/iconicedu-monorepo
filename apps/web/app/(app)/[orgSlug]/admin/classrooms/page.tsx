import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { LearningSpacesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-dashboard';
import { AdminPageShell } from '@iconicedu/web/components/admin/admin-page-layout';

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

  return (
    <AdminPageShell title="Classrooms">
      <LearningSpacesDashboard orgSlug={orgSlug} />
    </AdminPageShell>
  );
}
