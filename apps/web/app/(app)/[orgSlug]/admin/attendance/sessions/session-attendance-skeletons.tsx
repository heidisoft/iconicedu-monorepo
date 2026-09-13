import { Skeleton } from '@iconicedu/ui-web';

// One fallback per independently-streamed section of the dashboard (trend chart,
// metrics/filters/breakdowns, and the session table), so a slow query for one
// section never blocks the others from painting.

export function TrendSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      data-testid="attendance-trend-skeleton"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="p-6">
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-4 px-6 py-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="attendance-overview-skeleton">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownSkeleton />
        <BreakdownSkeleton />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div
      className="w-full overflow-hidden rounded-xl border bg-card"
      data-testid="attendance-table-skeleton"
    >
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function SessionAttendanceDashboardSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <TrendSkeleton />
      <OverviewSkeleton />
      <TableSkeleton />
    </div>
  );
}
