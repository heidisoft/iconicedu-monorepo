import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { getAdminLearningSpaceRows } from '@iconicedu/web/lib/admin/learning-spaces';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { LearningSpacesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-dashboard';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';

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
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  const { currentUserProfile } = await getDashboardProfileContext(supabase, account.id);
  const rows = await getAdminLearningSpaceRows(org.id);
  const subjectCatalogResponse = await listActiveOrgSubjectCatalog(supabase, org.id);
  const subjectOptions = mapOrgSubjectRowsToOptions(subjectCatalogResponse.data);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Classrooms" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Classrooms</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage learning spaces, subjects, participants, and schedules.
            </p>
          </div>
        </div>
        <LearningSpacesDashboard
          rows={rows}
          currentUserTimezone={currentUserProfile?.prefs.timezone ?? null}
          subjectOptions={subjectOptions}
        />
      </div>
    </div>
  );
}
