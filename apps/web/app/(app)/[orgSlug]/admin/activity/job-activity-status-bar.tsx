import type { AdminJobActivityStatusCountVM } from '@iconicedu/shared-types';

import { cn } from '@iconicedu/ui-web/lib/utils';

import {
  JOB_ACTIVITY_TONE_BG,
  buildJobActivityStatusSegments,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';

type JobActivityStatusBarProps = {
  statusCounts: AdminJobActivityStatusCountVM[];
  /** Compact mode drops per-status percentages (used on overview cards). */
  compact?: boolean;
  className?: string;
};

export function JobActivityStatusBar({
  statusCounts,
  compact = false,
  className,
}: JobActivityStatusBarProps) {
  const { segments, total } = buildJobActivityStatusSegments(statusCounts);

  if (!total) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>No recent records</p>
    );
  }

  const summary = segments
    .map((segment) => `${segment.status}: ${segment.count}`)
    .join(', ');

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-muted',
          compact ? 'h-2' : 'h-2.5',
        )}
        role="img"
        aria-label={`Status distribution — ${summary}`}
      >
        {segments.map((segment) => (
          <div
            key={segment.status}
            className={JOB_ACTIVITY_TONE_BG[segment.tone]}
            style={{ width: `${segment.percent}%` }}
            title={`${segment.status}: ${segment.count} (${Math.round(segment.percent)}%)`}
          />
        ))}
      </div>
      <ul
        className={cn(
          'flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground',
          compact && 'gap-x-2',
        )}
      >
        {segments.map((segment) => (
          <li key={segment.status} className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-2 w-2 shrink-0 rounded-full',
                JOB_ACTIVITY_TONE_BG[segment.tone],
              )}
              aria-hidden
            />
            <span className="text-foreground">{segment.status}</span>
            <span>{segment.count}</span>
            {compact ? null : <span>· {Math.round(segment.percent)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
