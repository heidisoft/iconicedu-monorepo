import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader } from '@iconicedu/ui-web';
import { ResultsView } from '@iconicedu/web/components/assessments/results-view';

export const metadata: Metadata = { title: 'Admin · Session Results' };

export default async function SessionResultPage({
  params,
}: {
  params: Promise<{ orgSlug: string; deliveryId: string; sessionId: string }>;
}) {
  const { orgSlug, deliveryId, sessionId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const result = await api.getResult(sessionId).catch(() => null);
  if (!result) {
    // Try to compute it
    const computed = await api.computeResult(sessionId).catch(() => null);
    if (!computed) notFound();
    return (
      <div className="flex flex-1 flex-col">
        <DashboardHeader title="Session Results" />
        <div className="flex flex-1 flex-col p-6">
          <ResultsView result={computed} showAllReports />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Session Results"
        description={`${Math.round(result.percentage ?? 0)}% · ${result.skillScores?.length ?? 0} skills`}
      />
      <div className="flex flex-1 flex-col p-6">
        <ResultsView result={result} showAllReports />
      </div>
    </div>
  );
}
