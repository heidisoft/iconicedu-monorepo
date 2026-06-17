import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge } from '@iconicedu/ui-web';
import { ChevronRight, Clock } from 'lucide-react';

export const metadata: Metadata = { title: 'My Assessments' };

export default async function StudentAssessmentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const deliveries = await api.listDeliveries(org.id).catch(() => []);

  const pending = deliveries.filter((d) => d.accessType !== 'public');

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Assessments" description="Tests assigned to you." />
      <div className="flex flex-1 flex-col gap-4 p-6">
        {pending.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No assessments assigned yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((d) => (
              <Link key={d.id} href={`/${orgSlug}/assessments/${d.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.testTitle}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={d.completedCount > 0 ? 'secondary' : 'default'}>
                        {d.completedCount > 0 ? 'Completed' : 'Start'}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
