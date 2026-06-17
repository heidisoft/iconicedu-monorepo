import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, TrendingUp, Clock, ChevronRight, Zap } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin · Tests' };

export default async function TestsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const tests = await api.listTests(org.id).catch(() => []);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Tests"
        description="Assemble questions into static or adaptive assessments."
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tests.length} test{tests.length !== 1 ? 's' : ''}
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Test
            </Link>
          </Button>
        </div>

        {tests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <TrendingUp className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No tests yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create a static test to hand-pick questions, or an adaptive test that
                  adjusts to each student in real time.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Test
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tests.map((test) => (
              <Link key={test.id} href={`/${orgSlug}/admin/assessments/tests/${test.id}`}>
                <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {/* Mode indicator */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${test.mode === 'adaptive' ? 'bg-violet-100 dark:bg-violet-900' : 'bg-muted'}`}
                    >
                      {test.mode === 'adaptive' ? (
                        <Zap className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{test.title}</p>
                        <Badge
                          variant={test.mode === 'adaptive' ? 'default' : 'secondary'}
                          className="text-xs shrink-0"
                        >
                          {test.mode === 'adaptive' ? 'Adaptive' : 'Static'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {test.totalItems > 0 && (
                          <span>
                            {test.totalItems} question{test.totalItems !== 1 ? 's' : ''}
                          </span>
                        )}
                        {test.estimatedMinutes > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />~{test.estimatedMinutes} min
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
