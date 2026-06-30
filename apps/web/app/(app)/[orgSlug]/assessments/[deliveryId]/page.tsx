import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import {
  DashboardHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@iconicedu/ui-web';
import { Clock, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Assessment' };

export default async function DeliveryLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string; deliveryId: string }>;
}) {
  const { orgSlug, deliveryId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const delivery = await api.getDelivery(deliveryId, org.id).catch(() => null);
  if (!delivery) notFound();

  const sessions = await api.getMySessions().catch(() => []);
  const deliverySessions = sessions.filter(
    (session) => session.deliveryId === deliveryId,
  );
  const completedSession = deliverySessions.find((s) => s.status === 'completed');
  const activeSession = deliverySessions.find((s) => s.status === 'in_progress');

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={delivery.title} description={delivery.testTitle} />
      <div className="flex flex-1 flex-col gap-4 p-6 max-w-xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{delivery.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {delivery.estimatedMinutes && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" /> ~{delivery.estimatedMinutes} min
                </Badge>
              )}
              {delivery.skillCount && (
                <Badge variant="outline">{delivery.skillCount} skills</Badge>
              )}
              <Badge variant={delivery.testMode === 'adaptive' ? 'default' : 'secondary'}>
                {delivery.testMode === 'adaptive' ? 'Adaptive' : 'Standard'}
              </Badge>
            </div>

            {completedSession ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Completed</Badge>
                  {completedSession.percentage != null && (
                    <span className="text-sm">
                      {Math.round(completedSession.percentage)}%
                    </span>
                  )}
                </div>
                <Button asChild variant="outline">
                  <Link href={`/${orgSlug}/assessments/${deliveryId}/results`}>
                    View Results & Learning Plan
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {delivery.maxAttempts > 1 && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/${orgSlug}/assessments/${deliveryId}/take`}>
                      Retake assessment
                    </Link>
                  </Button>
                )}
              </div>
            ) : activeSession ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  You have an assessment in progress.
                </p>
                <Button asChild>
                  <Link href={`/${orgSlug}/assessments/${deliveryId}/take`}>
                    Continue Assessment
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <Button asChild>
                <Link href={`/${orgSlug}/assessments/${deliveryId}/take`}>
                  Start Assessment
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
