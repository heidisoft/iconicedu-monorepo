import { Injectable } from '@nestjs/common';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { EventPipelineService } from '@iconicedu/api/modules/events/event-pipeline.service';
import type {
  ActivityEventRow,
  ActivityEventTypeVM,
  AudienceRuleVM,
  EventPipelineJobKind,
  EntityRefVM,
  FeedScopeVM,
} from '@iconicedu/shared-types';

@Injectable()
export class EventsService {
  constructor(private readonly eventPipelineService: EventPipelineService) {}

  async publishEvent<TPayload extends object>(input: {
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

  async projectPendingEvents(input: { eventIds?: string[]; limit?: number }) {
    const supabase = createSupabaseServiceClient();
    return projectActivityEvents(supabase, input);
  }

  async dispatchDuePipelineJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
    jobKinds?: EventPipelineJobKind[];
  }) {
    return this.eventPipelineService.dispatchDueJobs(input);
  }
}
