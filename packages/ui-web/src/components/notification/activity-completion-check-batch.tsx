'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ActivityCompletionCheck } from '@iconicedu/ui-web/components/notification/activity-completion-check';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

type SessionEntry = {
  scheduleId: string;
  occurrenceStart: string;
  title: string;
  channelId: string;
  learningSpaceId?: string | null;
  sessionCompletion?: {
    id?: string;
    status?: 'pending' | 'confirmed' | 'disputed' | 'auto_confirmed';
  } | null;
};

function getSessionResponseKey(session: SessionEntry) {
  return `${session.scheduleId}:${session.occurrenceStart}`;
}

function getSessions(activity: ActivityFeedLeafItemVM): SessionEntry[] {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(m.sessions)) return [];
  return (m.sessions as unknown[]).filter(
    (s): s is SessionEntry =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Record<string, unknown>).scheduleId === 'string',
  );
}

type Props = {
  activity: ActivityFeedLeafItemVM;
};

export function ActivityCompletionCheckBatch({ activity }: Props) {
  const sessions = useMemo(() => getSessions(activity), [activity]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(
    () =>
      new Set(
        sessions
          .filter(
            (session) =>
              session.sessionCompletion?.status === 'confirmed' ||
              session.sessionCompletion?.status === 'disputed' ||
              session.sessionCompletion?.status === 'auto_confirmed',
          )
          .map(getSessionResponseKey),
      ),
  );

  if (sessions.length === 0) return null;

  const resolvedCount = resolvedIds.size;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-background/95 md:max-w-[420px]">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs font-bold text-foreground">
          {sessions.length} classes ended
        </p>
        {resolvedCount > 0 ? (
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">
            {resolvedCount} of {sessions.length} confirmed
          </span>
        ) : (
          <p className="text-xs text-muted-foreground">How did they go?</p>
        )}
      </div>

      {sessions.map((session, index) => {
        const isExpanded = expandedIndex === index;
        const sessionResponseKey = getSessionResponseKey(session);
        const isResolved = resolvedIds.has(sessionResponseKey);

        const syntheticActivity: ActivityFeedLeafItemVM = {
          ...activity,
          metadata: {
            ...(activity.metadata ?? {}),
            scheduleId: session.scheduleId,
            occurrenceStart: session.occurrenceStart,
            channelId: session.channelId,
            learningSpaceId: session.learningSpaceId ?? null,
            feedbackUiEnabled: true,
            completionCheckUiEnabled: true,
            sessionCompletionId: session.sessionCompletion?.id ?? null,
            sessionCompletion: session.sessionCompletion ?? null,
          },
        };

        return (
          <div
            key={`${session.scheduleId}:${session.occurrenceStart}`}
            className="border-t border-border/80"
          >
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/40',
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    isResolved ? 'bg-success' : 'bg-border',
                  )}
                />
                <span
                  className={cn(
                    'truncate text-xs font-semibold',
                    isResolved ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {session.title}
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>

            {isExpanded ? (
              <div className="px-3 pb-3">
                <ActivityCompletionCheck
                  activity={syntheticActivity}
                  onVoteSubmit={() =>
                    setResolvedIds((prev) => new Set([...prev, sessionResponseKey]))
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
