import type {
  ActivityEventTypeVM,
  AudienceRuleVM,
  FeedScopeVM,
} from '@iconicedu/shared-types';
import type { ActivityEventRow, EntityRefVM } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

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

function resolveInternalApiUrl() {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(
    /\/+$/,
    '',
  );
}

function resolveInternalActivityFeedToken() {
  return process.env.INTERNAL_ACTIVITY_FEED_TOKEN?.trim() || '';
}

async function parseInternalResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(errorBody?.message ?? `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function logActivityPublishFailure(reason: string, details: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.warn(
    `activity publish skipped ${JSON.stringify({
      reason,
      ...details,
    })}`,
  );
}

export async function publishActivityEvent<TPayload extends object>(
  input: PublishActivityEventInput<TPayload>,
) {
  void input.supabase;

  const internalApiUrl = resolveInternalApiUrl();

  if (!internalApiUrl) {
    logActivityPublishFailure('missing_api_url', {
      orgId: input.orgId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey ?? null,
    });
    return null;
  }

  const token = resolveInternalActivityFeedToken();
  if (!token) {
    logActivityPublishFailure('missing_internal_token', {
      orgId: input.orgId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey ?? null,
    });
    return null;
  }

  try {
    const response = await fetch(`${internalApiUrl}/internal/activity-feed/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
        createdBy: input.createdBy ?? input.actorProfileId ?? null,
      }),
    });

    return await parseInternalResponse<ActivityEventRow | null>(response);
  } catch (error) {
    logActivityPublishFailure('publish_failed', {
      orgId: input.orgId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey ?? null,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
