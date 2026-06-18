import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
import { CurriculumTreeEditor } from '@iconicedu/web/components/assessments/curriculum-tree-editor';

export const metadata: Metadata = { title: 'Admin · Curriculum · Subject' };

export default async function SubjectTreePage({
  params,
}: {
  params: Promise<{ orgSlug: string; subjectId: string }>;
}) {
  const { orgSlug, subjectId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const tree = await api.getSubjectTree(subjectId, org.id).catch(() => null);
  if (!tree) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={tree.subject.name} />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/${orgSlug}/admin/assessments/curriculum`}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Curriculum
          </Link>
        </Button>

        <CurriculumTreeEditor
          subject={tree.subject}
          domains={tree.domains}
          orgId={org.id}
        />
      </div>
    </div>
  );
}
