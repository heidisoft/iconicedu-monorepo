'use client';

import { Skeleton } from '@iconicedu/ui-web/ui/skeleton';

function LoadingMetricCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="size-12 rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-10 w-20 rounded-md" />
      <Skeleton className="mt-3 h-4 w-24 rounded-md" />
    </div>
  );
}

function LoadingContentBlock() {
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-6">
      <Skeleton className="h-8 w-44 rounded-md" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function LoadingSidebarBlock() {
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-6">
      <Skeleton className="h-8 w-36 rounded-md" />
      <Skeleton className="mt-3 h-5 w-56 rounded-md" />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <Skeleton className="mt-5 h-40 w-full rounded-2xl" />
    </div>
  );
}

export function DashboardPageLoading() {
  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="mb-4 rounded-3xl border border-border/60 bg-card/60 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 rounded-md" />
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LoadingMetricCard />
          <LoadingMetricCard />
          <LoadingMetricCard />
          <LoadingMetricCard />
        </div>

        <div className="grid gap-4 xl:grid-cols-[13fr_7fr]">
          <LoadingContentBlock />
          <LoadingSidebarBlock />
        </div>
      </div>
    </div>
  );
}
