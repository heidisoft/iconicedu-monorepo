'use client';

import { Skeleton } from '@iconicedu/ui-web/ui/skeleton';

function MetricCardSkeleton({
  tinted = false,
  showAction = false,
}: {
  tinted?: boolean;
  showAction?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border border-border p-5 ${
        tinted ? 'bg-primary/10' : 'bg-card'
      }`}
    >
      {showAction ? (
        <>
          <Skeleton className="h-7 w-40 rounded-md" />
          <Skeleton className="mt-3 h-4 w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
          <Skeleton className="mt-6 h-11 w-full rounded-xl" />
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="size-12 rounded-xl" />
          </div>
          <Skeleton className="mt-2 h-12 w-16 rounded-md" />
          <Skeleton className="mt-3 h-5 w-24 rounded-md" />
        </>
      )}
    </article>
  );
}

function SessionRowSkeleton() {
  return (
    <div className="rounded-[28px] border border-border bg-card/70 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-2xl sm:size-20" />
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-6 w-52 rounded-md sm:h-8 sm:w-64" />
            <Skeleton className="h-4 w-40 rounded-md sm:h-5 sm:w-48" />
          </div>
        </div>
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <Skeleton className="size-10 rounded-full sm:size-12" />
          <Skeleton className="h-10 w-24 rounded-full sm:h-12 sm:w-28" />
        </div>
      </div>
    </div>
  );
}

function SessionSectionSkeleton({
  labelWidthClassName,
  rowCount,
}: {
  labelWidthClassName: string;
  rowCount: number;
}) {
  return (
    <div className="space-y-3">
      <Skeleton className={`h-4 rounded-md ${labelWidthClassName}`} />
      {Array.from({ length: rowCount }).map((_, index) => (
        <SessionRowSkeleton key={index} />
      ))}
    </div>
  );
}

function QuickActionCardSkeleton({ inverted = false }: { inverted?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        inverted ? 'bg-primary' : 'border border-border bg-background/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <Skeleton
          className={`size-5 rounded-sm ${inverted ? 'bg-primary-foreground/30' : ''}`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton
            className={`h-5 w-24 rounded-md ${inverted ? 'bg-primary-foreground/30' : ''}`}
          />
          <Skeleton
            className={`h-4 w-28 rounded-md ${inverted ? 'bg-primary-foreground/20' : ''}`}
          />
          <Skeleton
            className={`h-4 w-24 rounded-md ${inverted ? 'bg-primary-foreground/20' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}

export function DashboardHomeSkeleton() {
  return (
    <section aria-label="Home loading" className="space-y-4">
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        data-testid="home-skeleton-metrics"
      >
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton tinted showAction />
      </div>

      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <article
          className="rounded-3xl border border-border bg-card/80 p-6"
          data-testid="home-skeleton-upcoming-sessions"
        >
          <Skeleton className="h-8 w-52 rounded-md" />
          <div className="mt-5 space-y-3">
            <SessionSectionSkeleton labelWidthClassName="w-20" rowCount={2} />
            <SessionSectionSkeleton labelWidthClassName="w-24" rowCount={2} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-8 w-12 rounded-md" />
            </div>
          </div>
        </article>

        <aside
          className="rounded-3xl border border-border bg-card/80 p-6"
          data-testid="home-skeleton-quick-actions"
        >
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="mt-2 h-5 w-52 rounded-md" />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickActionCardSkeleton inverted />
            <QuickActionCardSkeleton />
          </div>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-6 w-40 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
          </div>
        </aside>
      </div>
    </section>
  );
}
