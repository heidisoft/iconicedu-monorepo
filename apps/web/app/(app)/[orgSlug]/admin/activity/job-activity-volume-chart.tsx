import type { AdminJobActivityRecordVM } from '@iconicedu/shared-types';

import { buildJobActivityVolume } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';

type JobActivityVolumeChartProps = {
  records: AdminJobActivityRecordVM[];
};

const GRANULARITY_LABEL: Record<
  ReturnType<typeof buildJobActivityVolume>['granularity'],
  string
> = {
  hour: 'per hour',
  day: 'per day',
  week: 'per week',
};

export function JobActivityVolumeChart({ records }: JobActivityVolumeChartProps) {
  const { buckets, granularity, total } = buildJobActivityVolume(records);
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold">Recent volume</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sampled records by creation time ({GRANULARITY_LABEL[granularity]})
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{total} records</span>
      </div>
      {buckets.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No records to chart.
        </div>
      ) : (
        <div
          className="overflow-x-auto px-6 py-5"
          role="img"
          aria-label={`Record volume ${GRANULARITY_LABEL[granularity]}`}
        >
          <div className="flex h-40 min-w-[420px] items-end gap-2 border-b px-1 pt-6">
            {buckets.map((bucket) => (
              <div
                key={bucket.key}
                className="group flex h-full min-w-6 flex-1 flex-col justify-end"
              >
                <div className="mb-1 text-center text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {bucket.count}
                </div>
                <div
                  className="mx-auto w-full max-w-10 rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{ height: `${Math.max(4, (bucket.count / maximum) * 110)}px` }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex min-w-[420px] gap-2 px-1">
            {buckets.map((bucket) => (
              <div
                key={bucket.key}
                className="min-w-6 flex-1 truncate text-center text-[11px] text-muted-foreground"
              >
                {bucket.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
