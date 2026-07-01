import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button, Badge } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
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
    const computed = await api.computeResult(sessionId).catch(() => null);
    if (!computed) notFound();
    return (
      <div className="flex flex-1 flex-col">
        <DashboardHeader title="Session Results" />
        <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
          <div className="flex flex-col gap-4">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit text-muted-foreground"
            >
              <Link href={`/${orgSlug}/admin/assessments/deliveries/${deliveryId}`}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Delivery
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Session Results</h1>
          </div>
          <ResultsView result={computed} showAllReports />
        </div>
      </div>
    );
  }

  const pct = Math.round(result.percentage ?? 0);
  const skillCount = result.skillScores?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Session Results" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/deliveries/${deliveryId}`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Delivery
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Session Results</h1>
            {result.passed !== null && result.passed !== undefined && (
              <Badge variant={result.passed ? 'default' : 'destructive'}>
                {result.passed ? 'Passed' : 'Not passed'}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {pct}% · {skillCount} skill{skillCount !== 1 ? 's' : ''} assessed
            </span>
          </div>
        </div>
        <ResultsView result={result} showAllReports />
      </div>
    </div>
  );
}
