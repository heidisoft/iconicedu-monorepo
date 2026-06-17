import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, TrendingUp } from 'lucide-react';

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
        description={`${tests.length} test${tests.length !== 1 ? 's' : ''}`}
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Assemble items into static or adaptive tests.
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Test
            </Link>
          </Button>
        </div>

        {tests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                No tests yet. Create a test to assemble questions into a deliverable
                assessment.
              </p>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/tests/new`}>
                  <Plus className="mr-2 h-4 w-4" /> New Test
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {tests.map((test) => (
              <Link key={test.id} href={`/${orgSlug}/admin/assessments/tests/${test.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{test.title}</p>
                      {test.estimatedMinutes > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ~{test.estimatedMinutes} min · {test.totalItems} questions
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={test.mode === 'adaptive' ? 'default' : 'secondary'}>
                        {test.mode}
                      </Badge>
                    </div>
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
