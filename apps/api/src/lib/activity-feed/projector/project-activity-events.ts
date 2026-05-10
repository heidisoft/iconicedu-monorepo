import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

import { getActivityEventDefinition } from '@iconicedu/api/lib/activity-feed/definitions/activity-definitions';
import {
  truncateActivityPreview,
  truncatePreviewText,
} from '@iconicedu/api/lib/activity-feed/preview-text';
import { resolveActivityRenderContext } from '@iconicedu/api/lib/activity-feed/projector/activity-render-context';
import { resolveActiveConversationSuppressedRecipients } from '@iconicedu/api/lib/activity-feed/suppression/active-conversation-suppression';

async function getProfilesByIds(
  supabase: SupabaseServiceClient,
  orgId: string,
  profileIds: string[],
) {
  if (!profileIds.length) {
    return { data: [] as ProfileRow[], error: null };
  }

  return supabase
    .from('profiles')
    .select('*')
    .eq('org_id', orgId)
    .in('id', profileIds)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

const MAX_ATTEMPTS = 10;

function resolveProjectedLeafDedupeKey(input: {
  event: ActivityEventRow;
  recipientProfileId: string;
}) {
  return input.event.dedupe_key
    ? `${input.event.dedupe_key}:${input.recipientProfileId}`
    : null;
}

async function loadEvents(
  supabase: SupabaseServiceClient,
  input: { eventIds?: string[]; limit: number },
) {
  let query = supabase
    .from('activity_events')
    .select('*')
    .is('deleted_at', null)
    .lt('projection_attempts', MAX_ATTEMPTS)
    .order('occurred_at', { ascending: true })
    .limit(input.limit);

  if (input.eventIds?.length) {
    query = query.in('id', input.eventIds);
  } else {
    query = query.in('projection_status', ['pending', 'failed']);
  }

  const response = await query.returns<ActivityEventRow[]>();
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data ?? [];
}

async function updateEventStatus(
  supabase: SupabaseServiceClient,
  eventId: string,
  update: Record<string, unknown>,
) {
  const response = await supabase
    .from('activity_events')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .is('deleted_at', null);

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function upsertProjectionRow(
  supabase: SupabaseServiceClient,
  row: Record<string, unknown>,
) {
  const onConflict =
    typeof row.dedupe_key === 'string' && row.dedupe_key.length > 0
      ? 'recipient_profile_id,dedupe_key'
      : 'recipient_profile_id,source_event_id';
  const response = await supabase
    .from('activity_feed_items')
    .upsert(row, { onConflict })
    .select('id')
    .single<{ id: string }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data.id;
}

async function projectEvent(supabase: SupabaseServiceClient, event: ActivityEventRow) {
  const definition = getActivityEventDefinition(event.event_type);
  if (!definition) {
    throw new Error(`Unsupported activity event type: ${event.event_type}`);
  }
  const resolvedRecipientProfileIds = await definition.resolveRecipients(supabase, event);
  const suppressionResult = await resolveActiveConversationSuppressedRecipients({
    supabase,
    event,
    recipientProfileIds: resolvedRecipientProfileIds,
    now: event.occurred_at,
  });
  const recipientProfileIds = suppressionResult.recipientProfileIds;

  if (!recipientProfileIds.length) {
    return;
  }

  const recipientProfilesResponse = await getProfilesByIds(
    supabase,
    event.org_id,
    recipientProfileIds,
  );
  const recipientProfilesError =
    'error' in recipientProfilesResponse ? recipientProfilesResponse.error : null;
  if (recipientProfilesError) {
    throw new Error(recipientProfilesError.message);
  }

  const recipientTimezoneByProfileId = new Map(
    (recipientProfilesResponse.data ?? []).map((profile) => [
      profile.id,
      profile.timezone ?? null,
    ]),
  );
  const recipientRoleByProfileId = new Map(
    (recipientProfilesResponse.data ?? []).map((profile) => [
      profile.id,
      profile.kind ?? null,
    ]),
  );
  const recipientProfileById = new Map(
    (recipientProfilesResponse.data ?? []).map((profile) => [profile.id, profile]),
  );
  const refs = {
    actor: null,
    object: event.object_ref ?? undefined,
    target: event.target_ref ?? undefined,
  };
  for (const recipientProfileId of recipientProfileIds) {
    const recipientTimezone =
      recipientTimezoneByProfileId.get(recipientProfileId) ?? null;
    const recipientRole = recipientRoleByProfileId.get(recipientProfileId) ?? null;
    const recipientProfile = recipientProfileById.get(recipientProfileId);
    const activityContext = recipientProfile
      ? await resolveActivityRenderContext({
          supabase,
          event,
          recipientProfile,
        })
      : null;
    const recipientEvent =
      event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
        ? {
            ...event,
            payload: {
              ...event.payload,
              viewerTimezone: recipientTimezone,
              viewerRole: recipientRole,
              viewerRoleKeys: activityContext?.viewerRoleKeys ?? [],
              activityContext,
              viewerIsActor:
                Boolean(event.actor_profile_id) &&
                event.actor_profile_id === recipientProfileId,
            },
          }
        : event;
    const rendered = definition.render(recipientEvent);
    const summary = truncatePreviewText(rendered.summary);
    const preview = truncateActivityPreview(rendered.preview);
    const rowSummary = truncatePreviewText(rendered.summary ?? rendered.headline.primary);
    const content = {
      headline: rendered.headline,
      summary,
      preview,
      actionButton: rendered.actionButton,
      expandedContent: rendered.expandedContent,
      leading: rendered.leading,
    };
    const isActorRecipient =
      Boolean(event.actor_profile_id) && event.actor_profile_id === recipientProfileId;
    await upsertProjectionRow(supabase, {
      org_id: event.org_id,
      recipient_profile_id: recipientProfileId,
      source_event_id: event.id,
      dedupe_key: resolveProjectedLeafDedupeKey({
        event,
        recipientProfileId,
      }),
      kind: 'leaf',
      occurred_at: event.occurred_at,
      tab_key: definition.tabKey,
      audience: {
        scope: event.scope,
        visibility: 'scope_only',
        audience: event.audience_rules ?? [],
      },
      verb: rendered.verb,
      actor_profile_id: event.actor_profile_id ?? null,
      refs,
      content,
      summary: rowSummary,
      preview: preview ?? null,
      action_button: rendered.actionButton ?? null,
      expanded_content: rendered.expandedContent ?? null,
      importance: definition.importance ?? 'normal',
      is_read: isActorRecipient,
      read_at: isActorRecipient ? event.occurred_at : null,
      metadata: {
        ...(activityContext
          ? {
              classTitle: activityContext.classTitle ?? null,
              contextTitle: activityContext.contextTitle ?? null,
              teacherNames: activityContext.teacherNames,
              studentNames: activityContext.studentNames,
              guardianNames: activityContext.guardianNames,
              viewerStudentNames: activityContext.viewerStudentNames,
              participantNamesLabel: activityContext.participantNamesLabel ?? null,
              viewerRole: activityContext.viewerRole ?? null,
              viewerRoleKeys: activityContext.viewerRoleKeys,
              viewerIsAdminStaff: activityContext.viewerIsAdminStaff,
            }
          : {}),
        ...(rendered.metadata ?? {}),
      },
      created_at: event.occurred_at,
      updated_at: new Date().toISOString(),
      created_by: event.actor_profile_id ?? null,
      updated_by: event.actor_profile_id ?? null,
    });
  }

  const notificationJobResponse = await supabase.rpc('enqueue_event_pipeline_job', {
    p_org_id: event.org_id,
    p_job_kind: 'notification.prepare',
    p_dedupe_key: `notification.prepare:${event.id}`,
    p_payload: {
      eventId: event.id,
      recipientProfileIds,
    },
    p_outbox_id: null,
    p_source_kind: 'activity_event',
    p_source_id: event.id,
    p_run_at: new Date().toISOString(),
    p_priority: 70,
    p_created_by: event.created_by ?? event.actor_profile_id ?? null,
    p_updated_by: event.updated_by ?? event.actor_profile_id ?? null,
  });

  if (notificationJobResponse.error) {
    throw new Error(notificationJobResponse.error.message);
  }
}

export async function projectActivityEvents(
  supabase: SupabaseServiceClient,
  input: { eventIds?: string[]; limit?: number } = {},
) {
  const events = await loadEvents(supabase, {
    eventIds: input.eventIds,
    limit: input.limit ?? 25,
  });

  for (const event of events) {
    try {
      await updateEventStatus(supabase, event.id, {
        projection_status: 'processing',
        projection_attempts: (event.projection_attempts ?? 0) + 1,
        last_projection_error: null,
      });
      await projectEvent(supabase, event);
      await updateEventStatus(supabase, event.id, {
        projection_status: 'projected',
      });
    } catch (error) {
      await updateEventStatus(supabase, event.id, {
        projection_status: 'failed',
        last_projection_error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { processed: events.length };
}
