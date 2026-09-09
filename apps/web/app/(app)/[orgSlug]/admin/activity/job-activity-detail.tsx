import type { AdminJobActivityGroupVM } from '@iconicedu/shared-types';

import { formatJobActivityDateTime } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';
import { JobActivityStatusBar } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-status-bar';
import { JobActivityTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-table';
import { JobActivityVolumeChart } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-volume-chart';

type JobActivityDetailProps = {
  group: AdminJobActivityGroupVM;
};

export function JobActivityDetail({ group }: JobActivityDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {group.unavailable ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-warning">
          <p className="font-medium">This queue could not be read.</p>
          <p className="mt-1 text-xs">
            {group.unavailableReason ??
              'The table is not reachable through the Data API in this environment.'}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Sampled records</p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {group.sampledCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Worker</p>
          <p className="mt-2 truncate text-base font-medium">{group.workerName}</p>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Last processed</p>
          <p className="mt-2 text-base font-medium">
            {formatJobActivityDateTime(group.latestProcessedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-6 py-4">
            <h2 className="text-sm font-semibold">Status distribution</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Across the {group.sampledCount} most recent records
            </p>
          </div>
          <div className="px-6 py-5">
            <JobActivityStatusBar statusCounts={group.statusCounts} />
          </div>
        </div>
        <JobActivityVolumeChart records={group.records} />
      </div>

      <JobActivityTable records={group.records} />
    </div>
  );
}
