import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge, Button, Separator } from '@iconicedu/ui-web';
import { Users, Plus, ArrowRight, CheckCircle2, Circle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin · Assessments',
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  public: 'Public',
  authenticated: 'Authenticated',
  class: 'Class',
  specific_users: 'Specific users',
};

export default async function AssessmentsOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const [subjects, items, tests, deliveries] = await Promise.all([
    api.listSubjects(org.id).catch(() => []),
    api.listItems(org.id).catch(() => ({ items: [], total: 0 })),
    api.listTests(org.id).catch(() => ({ tests: [], total: 0 })),
    api.listDeliveries(org.id).catch(() => ({ deliveries: [], total: 0 })),
  ]);

  const hasAnything = subjects.length > 0 || items.total > 0 || tests.total > 0;

  const kpis = [
    {
      label: 'Subjects',
      value: subjects.length,
      description: 'in curriculum',
      href: `/${orgSlug}/admin/assessments/curriculum`,
    },
    {
      label: 'Questions',
      value: items.total,
      description: 'in item bank',
      href: `/${orgSlug}/admin/assessments/items`,
    },
    {
      label: 'Tests',
      value: tests.total,
      description: 'assembled',
      href: `/${orgSlug}/admin/assessments/tests`,
    },
    {
      label: 'Deliveries',
      value: deliveries.total,
      description: 'sent or active',
      href: `/${orgSlug}/admin/assessments/deliveries`,
    },
  ];

  const setupSteps = [
    {
      done: subjects.length > 0,
      label: 'Define your curriculum',
      description: 'Create subjects, domains, and skills',
      href: `/${orgSlug}/admin/assessments/curriculum`,
    },
    {
      done: items.total > 0,
      label: 'Build your item bank',
      description: 'Add questions tagged to each skill',
      href: `/${orgSlug}/admin/assessments/items/new`,
    },
    {
      done: tests.total > 0,
      label: 'Create a test',
      description: 'Assemble questions into a static or adaptive test',
      href: `/${orgSlug}/admin/assessments/tests/new`,
    },
    {
      done: deliveries.total > 0,
      label: 'Send a delivery',
      description: 'Assign the test to a class or share a public link',
      href: `/${orgSlug}/admin/assessments/deliveries/new`,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Assessments" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build and deliver adaptive assessments, track skill mastery, and generate
              reports.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm" variant="outline">
              <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Test
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/${orgSlug}/admin/assessments/items/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href}>
              <div className="rounded-xl border bg-card px-5 pt-4 pb-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <div className="flex items-end justify-between mt-2 gap-2">
                  <p className="text-4xl font-bold tracking-tight leading-none">
                    {kpi.value}
                  </p>
                  <span className="mb-0.5 shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {kpi.description}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Setup checklist — only shown until something exists */}
        {!hasAnything && (
          <>
            <Separator />
            <div className="rounded-xl border overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/30">
                <p className="text-sm font-semibold">Get started</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Follow these four steps to set up your first assessment.
                </p>
              </div>
              <div className="divide-y">
                {setupSteps.map((step, i) => (
                  <Link
                    key={i}
                    href={step.href}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Recent deliveries */}
        {deliveries.total > 0 && (
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">Recent deliveries</h2>
              <Button asChild variant="ghost" size="sm" className="text-xs h-7 -mr-2">
                <Link href={`/${orgSlug}/admin/assessments/deliveries`}>
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="divide-y">
              {deliveries.deliveries.slice(0, 5).map((d) => {
                const completionPct =
                  d.sessionCount > 0
                    ? Math.round((d.completedCount / d.sessionCount) * 100)
                    : null;
                return (
                  <Link
                    key={d.id}
                    href={`/${orgSlug}/admin/assessments/deliveries/${d.id}`}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {d.testTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={d.accessType === 'public' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {ACCESS_TYPE_LABELS[d.accessType] ?? d.accessType}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {d.completedCount}/{d.sessionCount}
                        {completionPct !== null && (
                          <span className="text-muted-foreground/70">
                            ({completionPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
