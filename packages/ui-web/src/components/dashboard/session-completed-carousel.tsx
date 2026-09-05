'use client';

import { useEffect, useState } from 'react';
import type {
  ActivityFeedLeafItemVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
import { ActivityCompletionCheck } from '@iconicedu/ui-web/components/notification/activity-completion-check';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@iconicedu/ui-web/ui/carousel';

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

export function SessionCompletedCarousel({
  completions,
}: {
  completions: SessionCompletionVM[];
}) {
  const [visibleCompletions, setVisibleCompletions] = useState(completions);

  useEffect(() => {
    setVisibleCompletions(completions);
  }, [completions]);

  const remove = (id: string) => {
    setVisibleCompletions((current) => current.filter((item) => item.id !== id));
  };

  if (!visibleCompletions.length) return null;

  return (
    <section
      aria-labelledby="session-completed-heading"
      className="rounded-3xl border border-border bg-card/80 p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 id="session-completed-heading" className="font-semibold tracking-tight">
            Session Completed
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm each finished session, then leave a rating.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {visibleCompletions.length}
        </span>
      </div>

      <Carousel opts={{ align: 'start', loop: false }}>
        <CarouselContent>
          {visibleCompletions.map((completion) => (
            <CarouselItem key={completion.id} className="basis-full">
              <ActivityCompletionCheck
                activity={toActivity(completion)}
                onVoteSubmit={(status) => {
                  if (status === 'disputed') remove(completion.id);
                }}
                onRatingSubmit={() => remove(completion.id)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {visibleCompletions.length > 1 ? (
          <div className="mt-4 flex justify-end gap-2">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        ) : null}
      </Carousel>
    </section>
  );
}
