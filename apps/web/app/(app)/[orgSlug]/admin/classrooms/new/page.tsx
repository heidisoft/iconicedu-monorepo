import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DashboardHeader, Button } from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { LearningSpaceForm } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-space-form';

export const metadata: Metadata = { title: 'Admin · New Classroom' };

export default async function NewClassroomPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const [participantOptions, subjectCatalogResponse, profileResponse] = await Promise.all(
    [
      getActiveParticipantProfiles(org.id),
      listActiveOrgSubjectCatalog(supabase, org.id),
      supabase
        .from('profiles')
        .select('timezone')
        .eq('account_id', account.id)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<{ timezone: string | null }>(),
    ],
  );

  const subjectOptions = mapOrgSubjectRowsToOptions(subjectCatalogResponse.data);
  const defaultTimezone = profileResponse.data?.timezone ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="New Classroom" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/classrooms`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Classrooms
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Classroom</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the basics, participants, and schedule for a new classroom.
            </p>
          </div>
        </div>

        <LearningSpaceForm
          orgSlug={orgSlug}
          participantOptions={participantOptions}
          subjectOptions={subjectOptions}
          defaultScheduleTimezone={defaultTimezone}
          mode="create"
        />
      </div>
    </div>
  );
}
