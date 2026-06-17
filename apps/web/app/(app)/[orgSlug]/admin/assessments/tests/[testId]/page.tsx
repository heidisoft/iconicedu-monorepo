import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge } from '@iconicedu/ui-web';
import { TestBuilder } from '@iconicedu/web/components/assessments/test-builder';

export const metadata: Metadata = { title: 'Admin · Test Builder' };

export default async function TestBuilderPage({
  params,
}: {
  params: Promise<{ orgSlug: string; testId: string }>;
}) {
  const { orgSlug, testId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const test = await api.getTest(testId, org.id).catch(() => null);
  if (!test) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title={test.title}
        description={
          test.mode === 'adaptive'
            ? 'Adaptive test — configure skill pools and adaptive rules'
            : 'Static test — manage sections and questions'
        }
      />
      <div className="flex flex-1 flex-col p-6">
        <TestBuilder test={test} orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
