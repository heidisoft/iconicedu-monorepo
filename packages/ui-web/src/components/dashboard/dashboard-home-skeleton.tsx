'use client';

import { Skeleton } from '@iconicedu/ui-web/ui/skeleton';

function MetricCardSkeleton({ tinted = false }: { tinted?: boolean }) {
  return (
    <article
      className={`rounded-2xl border border-border p-5 ${
        tinted ? 'bg-primary/10' : 'bg-card'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton className="h-7 w-40 rounded-md" />
        <Skeleton className="size-12 rounded-xl" />
      </div>
      <Skeleton className="mt-2 h-12 w-16 rounded-md" />
      <Skeleton className="mt-3 h-5 w-24 rounded-md" />
      {tinted ? <Skeleton className="mt-8 h-11 w-full rounded-xl" /> : null}
    </article>
  );
}

function SessionRowSkeleton() {
  return (
    <div className="rounded-[28px] border border-border bg-card/70 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-5 w-48 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-12 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function DashboardHomeSkeleton() {
  return (
    <section aria-label="Home loading" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton tinted />
      </div>

      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <article className="rounded-3xl border border-border bg-card/80 p-6">
          <Skeleton className="h-8 w-52 rounded-md" />
          <div className="mt-5 space-y-3">
            <SessionRowSkeleton />
            <SessionRowSkeleton />
            <SessionRowSkeleton />
            <SessionRowSkeleton />
          </div>
        </article>

        <aside className="rounded-3xl border border-border bg-card/80 p-6">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="mt-3 h-5 w-52 rounded-md" />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-7 w-48 rounded-md" />
                <Skeleton className="h-5 w-full rounded-md" />
                <Skeleton className="h-5 w-4/5 rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
          </div>
        </aside>
      </div>
    </section>
  );
}
