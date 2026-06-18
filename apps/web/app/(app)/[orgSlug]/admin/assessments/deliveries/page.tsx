import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge, Button } from '@iconicedu/ui-web';
import { Plus, Send, Users, Globe, Lock, Users2, ChevronRight } from 'lucide-react';
import { ListFilters } from '@iconicedu/web/components/assessments/list-filters';
import { ListPagination } from '@iconicedu/web/components/assessments/list-pagination';

export const metadata: Metadata = { title: 'Admin · Deliveries' };

const PAGE_SIZE = 20;

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
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ search?: string; accessType?: string; page?: string }>;
}) {
  const { orgSlug } = await params;
  const filters = await searchParams;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const { deliveries, total } = await api
    .listDeliveries(org.id, {
      search: filters.search,
      accessType: filters.accessType,
      page: filters.page ? Number(filters.page) : 1,
      limit: PAGE_SIZE,
    })
    .catch(() => ({ deliveries: [], total: 0 }));

  const hasActiveFilters = !!(filters.search || filters.accessType);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Deliveries" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assign tests to classes or create public links for anonymous participants.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Delivery
            </Link>
          </Button>
        </div>

        {/* Filters — only shown once there's data or an active filter */}
        {(total > 0 || hasActiveFilters) && (
          <ListFilters
            searchPlaceholder="Search deliveries…"
            filters={[
              {
                key: 'accessType',
                label: 'Access',
                options: [
                  { value: 'public', label: 'Public' },
                  { value: 'authenticated', label: 'Authenticated' },
                  { value: 'class', label: 'Class' },
                  { value: 'specific_users', label: 'Specific users' },
                ],
              },
            ]}
          />
        )}

        {/* List */}
        {deliveries.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Send className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              {hasActiveFilters ? (
                <>
                  <p className="text-sm font-medium">No deliveries match your filters</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try adjusting or clearing the filters above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No deliveries yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    A delivery assigns a test to an audience. Target a class, require
                    login, or generate a public link anyone can access.
                  </p>
                </>
              )}
            </div>
            {!hasActiveFilters && (
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/deliveries/new`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Delivery
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">Deliveries ({total})</h2>
              </div>
              <div className="divide-y">
                {deliveries.map((d) => {
                  const access =
                    ACCESS_CONFIG[d.accessType] ?? ACCESS_CONFIG.authenticated;
                  const AccessIcon = access.icon;
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
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <AccessIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {d.testTitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {d.completedCount}/{d.sessionCount}
                          {completionPct !== null && (
                            <span className="ml-1 text-muted-foreground/70">
                              ({completionPct}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <Badge variant={access.variant} className="shrink-0">
                        {access.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            </div>
            <ListPagination total={total} pageSize={PAGE_SIZE} />
          </div>
        )}
      </div>
    </div>
  );
}
