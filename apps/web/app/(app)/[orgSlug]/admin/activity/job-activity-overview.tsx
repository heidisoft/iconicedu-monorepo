import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { AdminJobActivityOverviewVM } from '@iconicedu/shared-types';

import { formatJobActivityDateTime } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';
import { JobActivityStatusBar } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-status-bar';

type JobActivityOverviewProps = {
  overview: AdminJobActivityOverviewVM;
  basePath: string;
};

export function JobActivityOverview({ overview, basePath }: JobActivityOverviewProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-right text-xs text-muted-foreground">
        Generated {formatJobActivityDateTime(overview.generatedAt)}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {overview.groups.map((group) => (
          <Link
            key={group.kind}
            href={`${basePath}/admin/activity/${group.kind}`}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{group.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            <JobActivityStatusBar statusCounts={group.statusCounts} compact />

            <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
              <span>{group.sampledCount} sampled</span>
              <span>
                Last processed {formatJobActivityDateTime(group.latestProcessedAt)}
              </span>
            </div>
          </Link>
        ))}
        {!overview.groups.length ? (
          <p className="text-sm text-muted-foreground">No job activity available.</p>
        ) : null}
      </div>
    </div>
  );
}
