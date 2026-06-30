import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader } from '@iconicedu/ui-web';
import { ResultsView } from '@iconicedu/web/components/assessments/results-view';

export const metadata: Metadata = { title: 'Assessment Results' };

export default async function StudentResultsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; deliveryId: string }>;
}) {
  const { orgSlug, deliveryId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const sessions = await api.getMySessions().catch(() => []);
  const latestSession = sessions
    .filter((s) => s.deliveryId === deliveryId && s.status === 'completed')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0];

  if (!latestSession) {
    return (
      <div className="flex flex-1 flex-col">
        <DashboardHeader title="Results" />
        <div className="flex flex-1 flex-col p-6">
          <p className="text-muted-foreground">No completed sessions found.</p>
        </div>
      </div>
    );
  }

  const result = await api.getResult(latestSession.id).catch(async () => {
    return api.computeResult(latestSession.id).catch(() => null);
  });

  if (!result) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Your Results"
        description={`${Math.round(result.percentage ?? 0)}% overall`}
      />
      <div className="flex flex-1 flex-col p-6">
        <ResultsView result={result} showAllReports={false} />
      </div>
    </div>
  );
}
