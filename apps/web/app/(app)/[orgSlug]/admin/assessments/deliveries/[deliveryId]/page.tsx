import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge, Button } from '@iconicedu/ui-web';
import { ArrowLeft, ChevronRight, CheckCircle2, Clock, Send } from 'lucide-react';
import { DeliverySharePanel } from '@iconicedu/web/components/assessments/delivery-share-panel';

export const metadata: Metadata = { title: 'Admin · Delivery Results' };

const ACCESS_TYPE_LABELS: Record<string, string> = {
  public: 'Public',
  authenticated: 'Authenticated',
  class: 'Class',
  specific_users: 'Specific users',
};

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
    <div className="flex items-center gap-2 shrink-0">
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
  const scoredSessions = completedSessions.filter((s) => s.percentage !== undefined);
  const avgScore =
    scoredSessions.length > 0
      ? Math.round(
          scoredSessions.reduce((sum, s) => sum + (s.percentage ?? 0), 0) /
            scoredSessions.length,
        )
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={delivery.title} />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        {/* Back + title */}
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/deliveries`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> All deliveries
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{delivery.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{delivery.testTitle}</p>
            </div>
            <Badge
              variant={delivery.accessType === 'public' ? 'default' : 'secondary'}
              className="mt-1 shrink-0"
            >
              {ACCESS_TYPE_LABELS[delivery.accessType] ?? delivery.accessType}
            </Badge>
          </div>
        </div>

        {/* KPI stats — same style as overview page */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
            <p className="text-sm text-muted-foreground">Sessions</p>
            <div className="flex items-end justify-between mt-2 gap-2">
              <p className="text-4xl font-bold tracking-tight leading-none">
                {delivery.sessionCount ?? 0}
              </p>
              <span className="mb-0.5 shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                total started
              </span>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
            <p className="text-sm text-muted-foreground">Completed</p>
            <div className="flex items-end justify-between mt-2 gap-2">
              <p className="text-4xl font-bold tracking-tight leading-none">
                {delivery.completedCount ?? 0}
              </p>
              <span className="mb-0.5 shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {sessions.length > 0 ? `${completionRate}% rate` : 'no sessions'}
              </span>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 rounded-xl border bg-card px-5 pt-4 pb-5">
            <p className="text-sm text-muted-foreground">Avg score</p>
            <div className="flex items-end justify-between mt-2 gap-2">
              <p className="text-4xl font-bold tracking-tight leading-none">
                {avgScore !== null ? `${avgScore}%` : '—'}
              </p>
              <span className="mb-0.5 shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                completed only
              </span>
            </div>
          </div>
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

        {/* Sessions table */}
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <div>
              <p className="text-sm font-semibold">Sessions ({sessions.length})</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click a session to view detailed results and reports.
              </p>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Send className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No sessions yet. Share the delivery link to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => {
                const statusConfig = STATUS_CONFIG[session.status] ?? {
                  label: session.status,
                  variant: 'outline' as const,
                };
                return (
                  <Link
                    key={session.id}
                    href={`/${orgSlug}/admin/assessments/deliveries/${deliveryId}/results/${session.id}`}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="shrink-0">
                      {session.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {session.profileName ?? session.anonName ?? 'Anonymous'}
                      </p>
                      {session.completedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(session.completedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>

                    {session.percentage !== undefined && session.percentage !== null ? (
                      <ScoreBar pct={session.percentage} />
                    ) : (
                      <div className="w-28 shrink-0" />
                    )}

                    <Badge variant={statusConfig.variant} className="shrink-0">
                      {statusConfig.label}
                    </Badge>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
