import { Injectable } from '@nestjs/common';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';
import { dispatchDueNotificationJobs } from '@iconicedu/api/lib/notifications/dispatch-jobs';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  ActivityEventRow,
  ActivityEventTypeVM,
  AudienceRuleVM,
  EntityRefVM,
  FeedScopeVM,
} from '@iconicedu/shared-types';

@Injectable()
export class NotificationEngineService {
  async publishActivityEvent<TPayload extends object>(input: {
    orgId: string;
    eventType: ActivityEventTypeVM;
    emitterLabel?: string;
    occurredAt?: string;
    sourceKind: ActivityEventRow['source_kind'];
    actorProfileId?: string | null;
    scope: FeedScopeVM;
    objectRef?: EntityRefVM | null;
    targetRef?: EntityRefVM | null;
    audienceRules?: AudienceRuleVM[];
    payload: TPayload;
    dedupeKey?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseServiceClient();
    return publishActivityEvent({
      supabase,
      orgId: input.orgId,
      eventType: input.eventType,
      emitterLabel: input.emitterLabel,
      occurredAt: input.occurredAt,
      sourceKind: input.sourceKind,
      actorProfileId: input.actorProfileId ?? null,
      scope: input.scope,
      objectRef: input.objectRef ?? null,
      targetRef: input.targetRef ?? null,
      audienceRules: input.audienceRules ?? [],
      payload: input.payload,
      dedupeKey: input.dedupeKey ?? null,
      createdBy: input.createdBy ?? null,
    });
  }

  async projectActivityEvents(input: { eventIds?: string[]; limit?: number }) {
    const supabase = createSupabaseServiceClient();
    return projectActivityEvents(supabase, input);
  }

  async dispatchDueNotificationJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const supabase = createSupabaseServiceClient();
    return dispatchDueNotificationJobs({
      supabase,
      leaseOwner: input.leaseOwner,
      limit: input.limit,
      leaseSeconds: input.leaseSeconds,
    });
  }
}
