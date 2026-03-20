import type {
  ActivityEventTypeVM,
  AudienceRuleVM,
  FeedScopeVM,
  SystemNoticeActivityEventPayload,
} from '@iconicedu/shared-types';
import type { EntityRefVM } from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

import { projectActivityEvents } from '@iconicedu/web/lib/activity-feed/projector/project-activity-events';
import { getOrgById } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveActivityVerbSuppressionDecision } from '@iconicedu/web/lib/activity-feed/suppression/activity-verb-suppression';

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

async function resolveActivityOrgSlug(
  supabase: SupabaseServiceClient,
  orgId: string,
): Promise<string | null> {
  if (orgSlugCache.has(orgId)) {
    return orgSlugCache.get(orgId) ?? null;
  }

  const response = await getOrgById(supabase, orgId);
  if (response.error) {
    throw new Error(response.error.message);
  }

  const slug = response.data?.slug ?? null;
  orgSlugCache.set(orgId, slug);
  return slug;
}

export async function publishActivityEvent<TPayload extends object>(
  input: PublishActivityEventInput<TPayload>,
) {
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
          await projectActivityEvents(input.supabase, {
            eventIds: [existingResponse.data.id],
            limit: 1,
          });
        } catch {
          // Keep the event durable even if immediate projection fails.
        }
        return existingResponse.data;
      }
    }

    throw new Error(insertResponse.error.message);
  }

  try {
    await projectActivityEvents(input.supabase, {
      eventIds: [insertResponse.data.id],
      limit: 1,
    });
  } catch {
    // Keep the event durable even if immediate projection fails.
  }
  return insertResponse.data;
}

export async function publishSystemNoticeActivity(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  actorProfileId?: string | null;
  audienceRules: NonNullable<
    PublishActivityEventInput<SystemNoticeActivityEventPayload>['audienceRules']
  >;

  payload: SystemNoticeActivityEventPayload;
  dedupeKey?: string | null;
}) {
  return publishActivityEvent<SystemNoticeActivityEventPayload>({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType: 'system.notice',
    sourceKind: input.actorProfileId ? 'profile' : 'system',
    actorProfileId: input.actorProfileId ?? null,
    scope: { kind: 'global' },
    audienceRules: input.audienceRules,
    payload: input.payload,
    dedupeKey: input.dedupeKey,
  });
}
