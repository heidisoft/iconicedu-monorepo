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
  CardDescription,
  Badge,
  Button,
  Separator,
} from '@iconicedu/ui-web';
import {
  Users,
  BarChart2,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { DeliverySharePanel } from '@iconicedu/web/components/assessments/delivery-share-panel';

export const metadata: Metadata = { title: 'Admin · Delivery Results' };

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  completed: { label: 'Completed', variant: 'default' },
  in_progress: { label: 'In progress', variant: 'secondary' },
  not_started: { label: 'Not started', variant: 'outline' },
};

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold tabular-nums w-9 text-right">
        {Math.round(pct)}%
      </span>
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default async function DeliveryResultsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; deliveryId: string }>;
}) {
  const { orgSlug, deliveryId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const [delivery, rawResults] = await Promise.all([
    api.getDelivery(deliveryId, org.id).catch(() => null),
    api.getDeliveryResults(deliveryId).catch(() => []) as Promise<
      {
        session_id: string;
        profile_id: string | null;
        percentage: number | null;
        completed_at: string | null;
        assessment_sessions: { status: string; anon_name: string | null } | null;
      }[]
    >,
  ]);
  if (!delivery) notFound();

  const sessions = (rawResults ?? []).map((r) => ({
    id: r.session_id,
    anonName: r.assessment_sessions?.anon_name ?? undefined,
    profileName: undefined as string | undefined,
    percentage: r.percentage ?? undefined,
    completedAt: r.completed_at ?? undefined,
    status: r.assessment_sessions?.status ?? 'unknown',
  }));

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const completionRate =
    sessions.length > 0
      ? Math.round((completedSessions.length / sessions.length) * 100)
      : 0;
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions
            .filter((s) => s.percentage !== undefined)
            .reduce((sum, s) => sum + (s.percentage ?? 0), 0) /
            completedSessions.filter((s) => s.percentage !== undefined).length,
        )
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={delivery.title} description={delivery.testTitle} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Back link */}
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/deliveries`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> All deliveries
            </Link>
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Total sessions
              </p>
              <p className="text-2xl font-bold">{delivery.sessionCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Completed
              </p>
              <p className="text-2xl font-bold">{delivery.completedCount ?? 0}</p>
              {sessions.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completionRate}% rate
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Avg score
              </p>
              {avgScore !== null ? (
                <p className="text-2xl font-bold">{avgScore}%</p>
              ) : (
                <p className="text-2xl font-bold text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Access
              </p>
              <Badge
                variant={delivery.accessType === 'public' ? 'default' : 'secondary'}
                className="mt-1"
              >
                {delivery.accessType}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Share panel */}
        {delivery.accessType === 'public' && (
          <DeliverySharePanel
            deliveryId={delivery.id}
            accessToken={delivery.accessToken}
            publicUrl={delivery.publicUrl}
            orgId={org.id}
          />
        )}

        <Separator />

        {/* Sessions table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Sessions</CardTitle>
                <CardDescription className="mt-0.5">
                  Click any session to view detailed results and reports.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {sessions.length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No sessions yet. Share the delivery link to get started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {sessions.map((session, i) => {
                  const statusConfig = STATUS_CONFIG[session.status] ?? {
                    label: session.status,
                    variant: 'outline' as const,
                  };
                  return (
                    <Link
                      key={session.id}
                      href={`/${orgSlug}/admin/assessments/deliveries/${deliveryId}/results/${session.id}`}
                      className="group"
                    >
                      <div
                        className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors ${i < sessions.length - 1 ? 'border-b' : ''}`}
                      >
                        {/* Status icon */}
                        <div className="shrink-0">
                          {session.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Name + date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.profileName ?? session.anonName ?? 'Anonymous'}
                          </p>
                          {session.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.completedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>

                        {/* Score bar */}
                        {session.percentage !== undefined &&
                        session.percentage !== null ? (
                          <ScoreBar pct={session.percentage} />
                        ) : (
                          <div className="w-[5.5rem]" />
                        )}

                        {/* Status badge */}
                        <Badge
                          variant={statusConfig.variant}
                          className="text-xs shrink-0"
                        >
                          {statusConfig.label}
                        </Badge>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
