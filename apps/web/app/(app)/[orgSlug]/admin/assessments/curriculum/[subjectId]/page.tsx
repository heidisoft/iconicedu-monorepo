import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader } from '@iconicedu/ui-web';
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
      <DashboardHeader
        title={tree.subject.name}
        description={`${tree.domains.length} domain${tree.domains.length !== 1 ? 's' : ''} · ${tree.domains.reduce((sum, d) => sum + (d.skills?.length ?? 0), 0)} skills`}
      />
      <div className="flex flex-1 flex-col p-6">
        <CurriculumTreeEditor
          subject={tree.subject}
          domains={tree.domains}
          orgId={org.id}
        />
      </div>
    </div>
  );
}
