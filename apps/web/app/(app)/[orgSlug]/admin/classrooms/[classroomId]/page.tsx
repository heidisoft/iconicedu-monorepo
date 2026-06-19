import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DashboardHeader, Button, Badge } from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';
import { getLearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { LearningSpaceForm } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-space-form';

export const metadata: Metadata = { title: 'Admin · Edit Classroom' };

export default async function EditClassroomPage({
  params,
}: {
  params: Promise<{ orgSlug: string; classroomId: string }>;
}) {
  const { orgSlug, classroomId } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const [detail, participantOptions, subjectCatalogResponse, profileResponse] =
    await Promise.all([
      getLearningSpaceDetail(classroomId).catch(() => null),
      getActiveParticipantProfiles(org.id),
      listActiveOrgSubjectCatalog(supabase, org.id),
      supabase
        .from('profiles')
        .select('timezone')
        .eq('account_id', account.id)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<{ timezone: string | null }>(),
    ]);

  if (!detail) notFound();

  const subjectOptions = mapOrgSubjectRowsToOptions(subjectCatalogResponse.data);
  const defaultTimezone = profileResponse.data?.timezone ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Edit Classroom" />
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {detail.basics.title}
              </h1>
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Pencil className="h-3 w-3" /> Editing
              </Badge>
            </div>
            {(detail.basics.subject ?? detail.basics.description) && (
              <p className="text-sm text-muted-foreground mt-1">
                {detail.basics.subject ?? detail.basics.description}
              </p>
            )}
          </div>
        </div>

        <LearningSpaceForm
          orgSlug={orgSlug}
          participantOptions={participantOptions}
          subjectOptions={subjectOptions}
          defaultScheduleTimezone={defaultTimezone}
          mode="edit"
          initialData={detail}
        />
      </div>
    </div>
  );
}
