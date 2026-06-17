import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, Send, Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin · Deliveries' };

export default async function DeliveriesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const deliveries = await api.listDeliveries(org.id).catch(() => []);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Deliveries"
        description={`${deliveries.length} deliver${deliveries.length !== 1 ? 'ies' : 'y'}`}
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Assign tests to classes or create shareable public links.
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Delivery
            </Link>
          </Button>
        </div>

        {deliveries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <Send className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                No deliveries yet. Create a delivery to assign a test to students or
                generate a public link.
              </p>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
                  <Plus className="mr-2 h-4 w-4" /> New Delivery
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {deliveries.map((d) => (
              <Link key={d.id} href={`/${orgSlug}/admin/assessments/deliveries/${d.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.testTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={d.accessType === 'public' ? 'default' : 'secondary'}
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
        )}
      </div>
    </div>
  );
}
