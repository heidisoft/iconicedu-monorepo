'use client';

import { AlertCircle, CalendarClock } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

const CATEGORY_LABELS: Record<string, string> = {
  teacher_absent: 'Teacher absent',
  student_absent: 'Student absent',
  technical_issue: 'Technical issue',
  other: 'Other',
};

function getDisputeMetadata(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  return {
    title: typeof m.title === 'string' ? m.title : null,
    reportedByDisplayName:
      typeof m.reportedByDisplayName === 'string' ? m.reportedByDisplayName : null,
    reportedByRole: typeof m.reportedByRole === 'string' ? m.reportedByRole : null,
    disputeCategory: typeof m.disputeCategory === 'string' ? m.disputeCategory : null,
    disputeReason: typeof m.disputeReason === 'string' ? m.disputeReason : null,
    rescheduleRequested: m.rescheduleRequested === true,
    recipientRole:
      typeof m.recipientRole === 'string' && m.recipientRole === 'staff'
        ? ('staff' as const)
        : ('educator' as const),
    actionHref: typeof m.actionHref === 'string' ? m.actionHref : null,
    educatorNames: Array.isArray(m.educatorNames)
      ? (m.educatorNames as unknown[]).filter((n): n is string => typeof n === 'string')
      : [],
  };
}

type Props = {
  activity: ActivityFeedLeafItemVM;
};

export function ActivityDisputeReport({ activity }: Props) {
  const d = getDisputeMetadata(activity);
  const categoryLabel = d.disputeCategory
    ? (CATEGORY_LABELS[d.disputeCategory] ?? d.disputeCategory)
    : null;

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs md:max-w-[420px]">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          {d.reportedByDisplayName && d.title ? (
            <p className="font-semibold text-foreground">
              {d.reportedByDisplayName} reported{' '}
              <span className="text-amber-700">{d.title}</span> didn&apos;t happen
            </p>
          ) : null}

          {d.recipientRole === 'staff' && d.educatorNames.length > 0 ? (
            <p className="text-muted-foreground">
              Educator: {d.educatorNames.join(', ')}
            </p>
          ) : null}

          {categoryLabel ? (
            <span
              className={cn(
                'inline-flex rounded-full border px-2.5 py-0.5 font-semibold',
                'border-amber-300 bg-amber-100 text-amber-800',
              )}
            >
              {categoryLabel}
            </span>
          ) : null}

          {d.disputeReason ? (
            <p className="text-muted-foreground italic">
              &ldquo;{d.disputeReason}&rdquo;
            </p>
          ) : null}

          {d.rescheduleRequested ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Reschedule requested
            </div>
          ) : null}
        </div>
      </div>

      {d.actionHref ? (
        <div className="mt-3">
          <a
            href={d.actionHref}
            className={cn(
              'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              d.recipientRole === 'educator'
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {d.recipientRole === 'educator' ? 'Reschedule session' : 'View class'}
          </a>
        </div>
      ) : null}
    </div>
  );
}
