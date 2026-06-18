import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge, Button } from '@iconicedu/ui-web';
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
      <DashboardHeader title="Tests" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tests</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assemble your item bank into static or adaptive assessments.
            </p>
          </div>
          <Button asChild>
            <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Test
            </Link>
          </Button>
        </div>

        {/* List */}
        {tests.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <TrendingUp className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No tests yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create a static test to hand-pick questions, or an adaptive test that
                adjusts in real time to each student&apos;s answers.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Test
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">All tests ({tests.length})</h2>
            </div>

            <div className="divide-y">
              {tests.map((test) => (
                <Link
                  key={test.id}
                  href={`/${orgSlug}/admin/assessments/tests/${test.id}`}
                  className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Mode icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${test.mode === 'adaptive' ? 'bg-violet-100 dark:bg-violet-900' : 'bg-muted'}`}
                  >
                    {test.mode === 'adaptive' ? (
                      <Zap className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{test.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {test.totalItems > 0 && (
                        <span>
                          {test.totalItems} question{test.totalItems !== 1 ? 's' : ''}
                        </span>
                      )}
                      {test.estimatedMinutes > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />~{test.estimatedMinutes} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mode badge */}
                  <Badge
                    variant={test.mode === 'adaptive' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {test.mode === 'adaptive' ? 'Adaptive' : 'Static'}
                  </Badge>

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
