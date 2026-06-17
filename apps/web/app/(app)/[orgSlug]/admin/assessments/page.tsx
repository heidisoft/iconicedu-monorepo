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
  BookOpen,
  ClipboardList,
  Send,
  Users,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin · Assessments',
  description:
    'Manage your assessment platform — curriculum, items, tests, and deliveries.',
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
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const [subjects, items, tests, deliveries] = await Promise.all([
    api.listSubjects(org.id).catch(() => []),
    api.listItems(org.id).catch(() => ({ items: [], total: 0 })),
    api.listTests(org.id).catch(() => []),
    api.listDeliveries(org.id).catch(() => []),
  ]);

  const hasAnything = subjects.length > 0 || items.total > 0 || tests.length > 0;

  const kpis = [
    {
      label: 'Subjects',
      value: subjects.length,
      description: 'in curriculum',
      icon: BookOpen,
      href: `/${orgSlug}/admin/assessments/curriculum`,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Questions',
      value: items.total,
      description: 'in item bank',
      icon: ClipboardList,
      href: `/${orgSlug}/admin/assessments/items`,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950',
    },
    {
      label: 'Tests',
      value: tests.length,
      description: 'assembled',
      icon: TrendingUp,
      href: `/${orgSlug}/admin/assessments/tests`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: 'Deliveries',
      value: deliveries.length,
      description: 'sent or active',
      icon: Send,
      href: `/${orgSlug}/admin/assessments/deliveries`,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950',
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
      done: tests.length > 0,
      label: 'Create a test',
      description: 'Assemble questions into a static or adaptive test',
      href: `/${orgSlug}/admin/assessments/tests/new`,
    },
    {
      done: deliveries.length > 0,
      label: 'Send a delivery',
      description: 'Assign the test to a class or share a public link',
      href: `/${orgSlug}/admin/assessments/deliveries/new`,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Assessments"
        description="Build and deliver adaptive assessments, track skill mastery, and generate reports."
      />
      <div className="flex flex-1 flex-col gap-8 p-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="pt-4 pb-4">
                  <div
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${kpi.bg} mb-3`}
                  >
                    <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                  <p className="text-sm font-medium mt-0.5">{kpi.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {kpi.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/items/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Test
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> New Delivery
            </Link>
          </Button>
        </div>

        <Separator />

        {/* Setup checklist — only shown until all steps are done */}
        {!hasAnything && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Get started</CardTitle>
              <CardDescription>
                Follow these four steps to set up your first assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              {setupSteps.map((step, i) => (
                <Link key={i} href={step.href} className="group">
                  <div className="flex items-center gap-3 py-3 -mx-1 px-1 rounded-lg hover:bg-muted/50 transition-colors">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  {i < setupSteps.length - 1 && <Separator className="mx-8" />}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent deliveries */}
        {deliveries.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Deliveries</h2>
              <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                <Link href={`/${orgSlug}/admin/assessments/deliveries`}>
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {deliveries.slice(0, 5).map((d) => {
                const completionPct =
                  d.sessionCount > 0
                    ? Math.round((d.completedCount / d.sessionCount) * 100)
                    : null;
                return (
                  <Link
                    key={d.id}
                    href={`/${orgSlug}/admin/assessments/deliveries/${d.id}`}
                  >
                    <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{d.title}</p>
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
                            <span>
                              {d.completedCount}/{d.sessionCount}
                              {completionPct !== null && (
                                <span className="ml-1 text-muted-foreground/70">
                                  ({completionPct}%)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
