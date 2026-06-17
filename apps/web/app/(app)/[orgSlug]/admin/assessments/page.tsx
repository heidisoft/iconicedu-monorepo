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
import { BookOpen, ClipboardList, Send, Users, TrendingUp, Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin · Assessments',
  description:
    'Manage your assessment platform — curriculum, items, tests, and deliveries.',
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

  const kpis = [
    {
      label: 'Subjects',
      value: subjects.length,
      icon: BookOpen,
      href: 'assessments/curriculum',
      color: 'text-blue-600',
    },
    {
      label: 'Questions',
      value: items.total,
      icon: ClipboardList,
      href: 'assessments/items',
      color: 'text-purple-600',
    },
    {
      label: 'Tests',
      value: tests.length,
      icon: TrendingUp,
      href: 'assessments/tests',
      color: 'text-green-600',
    },
    {
      label: 'Deliveries',
      value: deliveries.length,
      icon: Send,
      href: 'assessments/deliveries',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Assessments" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/curriculum`}>
              <Plus className="mr-2 h-4 w-4" /> Define Skills
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/admin/assessments/items/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Question
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Test
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
              <Send className="mr-2 h-4 w-4" /> New Delivery
            </Link>
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={`/${orgSlug}/admin/${kpi.href}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Getting started checklist if no subjects yet */}
        {subjects.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Get started with assessments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Follow these steps to set up your assessment platform:
              </p>
              <ol className="list-decimal list-inside flex flex-col gap-2 text-sm">
                <li className="text-muted-foreground">
                  <Link
                    href={`/${orgSlug}/admin/assessments/curriculum`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Define your curriculum
                  </Link>{' '}
                  — create subjects, domains, and skills with prerequisite links
                </li>
                <li className="text-muted-foreground">
                  <Link
                    href={`/${orgSlug}/admin/assessments/items/new`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Build your item bank
                  </Link>{' '}
                  — add questions tagged to each skill at different difficulty levels
                </li>
                <li className="text-muted-foreground">
                  <Link
                    href={`/${orgSlug}/admin/assessments/tests/new`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Create a test
                  </Link>{' '}
                  — assemble items into a static or adaptive test
                </li>
                <li className="text-muted-foreground">
                  <Link
                    href={`/${orgSlug}/admin/assessments/deliveries/new`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Send a delivery
                  </Link>{' '}
                  — assign the test to a class or generate a public shareable link
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Recent deliveries */}
        {deliveries.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Recent Deliveries
            </h2>
            <div className="flex flex-col gap-2">
              {deliveries.slice(0, 5).map((d) => (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/admin/assessments/deliveries/${d.id}`}
                >
                  <Card className="hover:border-primary transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.testTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={d.accessType === 'public' ? 'secondary' : 'outline'}
                        >
                          {d.accessType}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {d.completedCount}/{d.sessionCount}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
