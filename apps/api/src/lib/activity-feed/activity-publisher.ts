import type {
  ActivityEventRow,
  ActivityEventTypeVM,
  AudienceRuleVM,
  EntityRefVM,
  FeedScopeVM,
} from '@iconicedu/shared-types';
import { Logger } from '@nestjs/common';

import { resolveActivityVerbSuppressionDecision } from '@iconicedu/api/lib/activity-feed/activity-verb-suppression';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

type PublishActivityEventInput<TPayload extends object = Record<string, unknown>> = {
  supabase: SupabaseServiceClient;
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
};

const orgSlugCache = new Map<string, string | null>();
const logger = new Logger('ActivityPublisher');

function logActivityPublishFailure(
  reason: string,
  input: Pick<
    PublishActivityEventInput,
    'orgId' | 'eventType' | 'emitterLabel' | 'dedupeKey'
  >,
  error?: unknown,
) {
  logger.warn(
    `activity publish skipped ${JSON.stringify({
      reason,
      orgId: input.orgId,
      eventType: input.eventType,
      emitterLabel: input.emitterLabel ?? null,
      dedupeKey: input.dedupeKey ?? null,
      errorMessage: error instanceof Error ? error.message : undefined,
    })}`,
  );
}

async function resolveActivityOrgSlug(
  supabase: SupabaseServiceClient,
  orgId: string,
): Promise<string | null> {
  if (orgSlugCache.has(orgId)) {
    return orgSlugCache.get(orgId) ?? null;
  }

  const response = await supabase
    .from('orgs')
    .select('slug')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle<{ slug: string | null }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  const slug = response.data?.slug ?? null;
  orgSlugCache.set(orgId, slug);
  return slug;
}

async function enqueueActivityProjectionJob(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  createdBy?: string | null;
}) {
  const response = await input.supabase.rpc('enqueue_event_pipeline_job', {
    p_org_id: input.event.org_id,
    p_job_kind: 'activity.project',
    p_dedupe_key: `activity.project:${input.event.id}`,
    p_payload: { eventId: input.event.id },
    p_outbox_id: null,
    p_source_kind: 'activity_event',
    p_source_id: input.event.id,
    p_run_at: new Date().toISOString(),
    p_priority: 60,
    p_created_by: input.createdBy ?? input.event.created_by ?? null,
    p_updated_by: input.createdBy ?? input.event.updated_by ?? null,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function publishActivityEvent<TPayload extends object>(
  input: PublishActivityEventInput<TPayload>,
) {
  try {
    const suppressionDecision = await resolveActivityVerbSuppressionDecision({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: input.eventType,
      actorProfileId: input.actorProfileId ?? null,
    });

    if (!suppressionDecision.shouldPublish) {
      return null;
    }

    const now = new Date().toISOString();
    const orgSlug = await resolveActivityOrgSlug(input.supabase, input.orgId);
    const payload = {
      ...(input.payload as Record<string, unknown>),
      ...(orgSlug ? { orgSlug } : {}),
    } as TPayload;

    const insertResponse = await input.supabase
      .from('activity_events')
      .insert({
        org_id: input.orgId,
        event_type: input.eventType,
        occurred_at: input.occurredAt ?? now,
        source_kind: input.sourceKind,
        actor_profile_id: input.actorProfileId ?? null,
        scope: input.scope,
        object_ref: input.objectRef ?? null,
        target_ref: input.targetRef ?? null,
        payload,
        audience_rules: input.audienceRules ?? [],
        dedupe_key: input.dedupeKey ?? null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: now,
        updated_at: now,
        created_by: input.createdBy ?? input.actorProfileId ?? null,
        updated_by: input.createdBy ?? input.actorProfileId ?? null,
      })
      .select('*')
      .single<ActivityEventRow>();

    if (insertResponse.error) {
      if (input.dedupeKey && insertResponse.error.code === '23505') {
        const existingResponse = await input.supabase
          .from('activity_events')
          .select('*')
          .eq('org_id', input.orgId)
          .eq('dedupe_key', input.dedupeKey)
          .is('deleted_at', null)
          .maybeSingle<ActivityEventRow>();

        if (existingResponse.error) {
          throw new Error(existingResponse.error.message);
        }

        if (existingResponse.data) {
          try {
            await enqueueActivityProjectionJob({
              supabase: input.supabase,
              event: existingResponse.data,
              createdBy: input.createdBy ?? input.actorProfileId ?? null,
            });
          } catch {
            // Keep the event durable even if projection enqueue fails.
          }
        }

        return existingResponse.data ?? null;
      }

      throw new Error(insertResponse.error.message);
    }

    try {
      await enqueueActivityProjectionJob({
        supabase: input.supabase,
        event: insertResponse.data,
        createdBy: input.createdBy ?? input.actorProfileId ?? null,
      });
    } catch {
      // Keep the event durable even if projection enqueue fails.
    }

    return insertResponse.data;
  } catch (error) {
    logActivityPublishFailure('publish_failed', input, error);
    return null;
  }
}
