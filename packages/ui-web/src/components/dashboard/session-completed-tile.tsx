'use client';

import { Clock3 } from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { ActivityCompletionCheck } from '@iconicedu/ui-web/components/notification/activity-completion-check';
import {
  formatScheduleDisplayTimeWithZone,
  resolveScheduleDisplayTimeZone,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';
import type {
  ActivityFeedLeafItemVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';

function toActivity(completion: SessionCompletionVM): ActivityFeedLeafItemVM {
  const title = completion.sessionTitle?.trim() || 'Session';
  return {
    kind: 'leaf',
    ids: { id: completion.id, orgId: completion.orgId },
    timestamps: {
      occurredAt: completion.sessionEndAt,
      createdAt: completion.notifiedAt ?? completion.sessionEndAt,
    },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'direct' },
    verb: 'session.completion_check.sent',
    refs: { object: { kind: 'session', id: completion.scheduleId } },
    content: {
      headline: { primary: 'Session Completed', secondary: title },
      summary: 'Confirm the session, then share a rating.',
    },
    state: { importance: 'normal', isRead: false },
    metadata: {
      orgId: completion.orgId,
      scheduleId: completion.scheduleId,
      occurrenceStart: completion.occurrenceKey,
      channelId: completion.channelId ?? null,
      learningSpaceId: completion.learningSpaceId ?? null,
      sessionCompletionId: completion.id,
      sessionCompletion: completion,
      completionCheckUiEnabled: true,
      feedbackUiEnabled: true,
      completionPromptTitle: 'Session Completed',
      completionPromptBody: `${title} has ended. Please confirm that it took place.`,
    },
  };
}

function formatDateChip(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { dayName: '', dayNum: '' };
  return {
    dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
    dayNum: date.toLocaleDateString(undefined, { day: 'numeric' }),
  };
}

// Matches SessionCard's compact time style (messages-session-card.tsx via
// formatCompactMeridiemTime) — lowercase am/pm, no space, plus the viewer's
// timezone label (e.g. "9:00am New York time").
function formatTime(iso: string) {
  const timezone = resolveScheduleDisplayTimeZone();
  const formatted = formatScheduleDisplayTimeWithZone(iso, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (!formatted) return '';
  return formatted.replace(' AM', 'am').replace(' PM', 'pm');
}

type SessionCompletedTileProps = {
  completion: SessionCompletionVM;
  onVoteSubmit?: (status: 'confirmed' | 'disputed') => void;
  onRatingSubmit?: () => void;
};

// Same shell shape as SessionCard (messages-session-card.tsx) — date chip, title +
// status badge, time row — so a completed session reads as one family of tile with
// the rest of the homepage's session lists, just carrying the completion actions
// instead of Join/Message buttons. Fills the full width of its carousel slot.
export function SessionCompletedTile({
  completion,
  onVoteSubmit,
  onRatingSubmit,
}: SessionCompletedTileProps) {
  const { dayName, dayNum } = formatDateChip(completion.sessionEndAt);
  const time = formatTime(completion.sessionEndAt);
  const title = completion.sessionTitle?.trim() || 'Session';

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-muted px-3 py-2 text-muted-foreground">
          <span className="text-xs font-medium">{dayName}</span>
          <span className="text-sm font-bold leading-tight">{dayNum}</span>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Completed
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            <span>
              {dayName} {time}
            </span>
            {completion.studentName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-primary">{completion.studentName}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Full-width, below the date/title row — not squeezed beside the date
          chip — so the description text and Confirm/Report buttons expand to
          the tile's full width. Matches the mobile SessionCompletedTile layout
          (apps/mobile/src/components/sessions/session-completed-tile.tsx). */}
      <ActivityCompletionCheck
        activity={toActivity(completion)}
        embedded
        onVoteSubmit={onVoteSubmit}
        onRatingSubmit={onRatingSubmit}
      />
    </div>
  );
}
