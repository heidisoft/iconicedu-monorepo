import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, Send, Users, Globe, Lock, Users2, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin · Deliveries' };

const ACCESS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }
> = {
  public: { label: 'Public', icon: Globe, variant: 'default' },
  authenticated: { label: 'Authenticated', icon: Lock, variant: 'secondary' },
  class: { label: 'Class', icon: Users2, variant: 'secondary' },
  specific_users: { label: 'Specific users', icon: Users2, variant: 'outline' },
};

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
        description="Assign tests to classes or share public links with anonymous participants."
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {deliveries.length} deliver{deliveries.length !== 1 ? 'ies' : 'y'}
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Delivery
            </Link>
          </Button>
        </div>

        {deliveries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Send className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No deliveries yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  A delivery assigns a test to students. You can target a class, require
                  login, or generate a public link anyone can use.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Delivery
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {deliveries.map((d) => {
              const access = ACCESS_CONFIG[d.accessType] ?? ACCESS_CONFIG.authenticated;
              const AccessIcon = access.icon;
              const completionPct =
                d.sessionCount > 0
                  ? Math.round((d.completedCount / d.sessionCount) * 100)
                  : null;

              return (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/admin/assessments/deliveries/${d.id}`}
                >
                  <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      {/* Access icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <AccessIcon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{d.title}</p>
                          <Badge variant={access.variant} className="text-xs shrink-0">
                            {access.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {d.testTitle}
                        </p>
                      </div>

                      {/* Completion */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {d.completedCount}/{d.sessionCount}
                          {completionPct !== null && (
                            <span className="text-muted-foreground/70 ml-1">
                              ({completionPct}%)
                            </span>
                          )}
                        </span>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
