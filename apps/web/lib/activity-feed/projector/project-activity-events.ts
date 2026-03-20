import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

import { getActivityEventDefinition } from '@iconicedu/web/lib/activity-feed/definitions/activity-definitions';
import { shouldReplaceGroupParent } from '@iconicedu/web/lib/activity-feed/projector/group-parent-priority';
import { resolveActiveConversationSuppressedRecipients } from '@iconicedu/web/lib/activity-feed/suppression/active-conversation-suppression';
import { enqueueNotificationDispatchJobs } from '@iconicedu/web/lib/notifications/dispatch-jobs';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

const MAX_ATTEMPTS = 10;
const HOURLY_HUDDLE_WINDOW_MS = 60 * 60 * 1000;
const SESSION_TIMELINE_EVENTS = new Set([
  'session.started',
  'member.joined',
  'member.removed',
  'session.ended',
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveHourlyHuddleChannelId(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const occurrenceStart =
    asOptionalString(payload.occurrenceStart) ??
    asOptionalString(payload.scheduledStartAt);
  if (occurrenceStart) {
    return null;
  }

  const scope = asRecord(event.scope);
  const channelId =
    asOptionalString(payload.channelId) ??
    (scope.kind === 'channel' ? asOptionalString(scope.channelId) : undefined);

  return channelId ?? null;
}

function buildNonLearningSpaceHuddleGroupKey(channelId: string, anchor: string) {
  return `live-session:channel:${channelId}:huddle-start:${anchor}`;
}

async function resolveHourlyHuddleGroupKey(
  supabase: SupabaseServiceClient,
  event: ActivityEventRow,
) {
  if (!SESSION_TIMELINE_EVENTS.has(event.event_type)) {
    return null;
  }

  const channelId = resolveHourlyHuddleChannelId(event);
  if (!channelId) {
    return null;
  }

  const currentOccurredAt = new Date(event.occurred_at);
  const cutoff = new Date(
    currentOccurredAt.getTime() - HOURLY_HUDDLE_WINDOW_MS,
  ).toISOString();
  const recentStartsResponse = await supabase
    .from('activity_events')
    .select('id, occurred_at')
    .eq('org_id', event.org_id)
    .eq('event_type', 'session.started')
    .contains('scope', { kind: 'channel', channelId })
    .gte('occurred_at', cutoff)
    .lt('occurred_at', event.occurred_at)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: true })
    .limit(1)
    .returns<Array<Pick<ActivityEventRow, 'id' | 'occurred_at'>>>();

  if (recentStartsResponse.error) {
    throw new Error(recentStartsResponse.error.message);
  }

  const recentStart = recentStartsResponse.data?.[0];
  if (recentStart) {
    return buildNonLearningSpaceHuddleGroupKey(channelId, recentStart.id);
  }

  if (event.event_type === 'session.started') {
    return buildNonLearningSpaceHuddleGroupKey(channelId, event.id);
  }

  const sameTimestampStartsResponse = await supabase
    .from('activity_events')
    .select('id')
    .eq('org_id', event.org_id)
    .eq('event_type', 'session.started')
    .contains('scope', { kind: 'channel', channelId })
    .eq('occurred_at', event.occurred_at)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .returns<Array<Pick<ActivityEventRow, 'id'>>>();

  if (sameTimestampStartsResponse.error) {
    throw new Error(sameTimestampStartsResponse.error.message);
  }

  const sameTimestampStart = sameTimestampStartsResponse.data?.[0];
  if (sameTimestampStart) {
    return buildNonLearningSpaceHuddleGroupKey(channelId, sameTimestampStart.id);
  }

  return buildNonLearningSpaceHuddleGroupKey(channelId, event.occurred_at.slice(0, 16));
}

async function resolveProjectedGroupKey(
  supabase: SupabaseServiceClient,
  event: ActivityEventRow,
  definition: NonNullable<ReturnType<typeof getActivityEventDefinition>>,
) {
  if (!definition.group) {
    return null;
  }

  const hourlyHuddleGroupKey = await resolveHourlyHuddleGroupKey(supabase, event);
  if (hourlyHuddleGroupKey) {
    return hourlyHuddleGroupKey;
  }

  return definition.group.buildGroupKey(event);
}

function resolveProjectedLeafDedupeKey(input: {
  event: ActivityEventRow;
  groupKey: string | null;
  recipientProfileId: string;
}) {
  if (input.event.event_type === 'session.started' && input.groupKey) {
    return `leaf:session.started:${input.groupKey}`;
  }

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

async function ensureGroupParent(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  recipientProfileId: string;
  groupKey: string;
  groupType: string;
  rendered: ReturnType<ReturnType<typeof getActivityEventDefinition>['render']>;
  tabKey: string;
  importance: string | undefined;
}) {
  const dedupeKey = `group:${input.groupKey}`;
  const isActorRecipient =
    Boolean(input.event.actor_profile_id) &&
    input.event.actor_profile_id === input.recipientProfileId;
  const row = {
    org_id: input.event.org_id,
    recipient_profile_id: input.recipientProfileId,
    source_event_id: null,
    dedupe_key: dedupeKey,
    kind: 'group',
    occurred_at: input.event.occurred_at,
    tab_key: input.tabKey,
    audience: {
      scope: input.event.scope,
      visibility: 'scope_only',
    },
    verb: input.rendered.verb,
    actor_profile_id: input.event.actor_profile_id ?? null,
    refs: {
      actor: null,
      object: input.event.object_ref ?? undefined,
      target: input.event.target_ref ?? undefined,
    },
    group_key: input.groupKey,
    group_type: input.groupType,
    is_collapsed: true,
    content: {
      headline: input.rendered.headline,
      summary: input.rendered.summary,
      leading: input.rendered.leading,
      actionButton: input.rendered.actionButton,
      expandedContent: input.rendered.expandedContent,
      preview: input.rendered.preview,
    },
    summary: input.rendered.summary ?? input.rendered.headline.primary,
    preview: input.rendered.preview ?? null,
    action_button: input.rendered.actionButton ?? null,
    expanded_content: input.rendered.expandedContent ?? null,
    metadata: input.rendered.metadata ?? {},
    importance: input.importance ?? 'normal',
    is_read: isActorRecipient,
    read_at: isActorRecipient ? input.event.occurred_at : null,
    created_at: input.event.occurred_at,
    updated_at: new Date().toISOString(),
  };

  const existingResponse = await input.supabase
    .from('activity_feed_items')
    .select('id, verb')
    .eq('org_id', input.event.org_id)
    .eq('recipient_profile_id', input.recipientProfileId)
    .eq('dedupe_key', dedupeKey)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; verb?: string | null }>();

  if (existingResponse.error) {
    throw new Error(existingResponse.error.message);
  }

  if (
    existingResponse.data &&
    !shouldReplaceGroupParent({
      groupKey: input.groupKey,
      existingVerb: existingResponse.data.verb ?? null,
      nextVerb: input.rendered.verb,
    })
  ) {
    // Keep the preferred parent verb/content, but refresh occurred_at so recency sorting
    // reflects the latest leaf activity in this group.
    const touchResponse = await input.supabase
      .from('activity_feed_items')
      .update({
        occurred_at: input.event.occurred_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingResponse.data.id)
      .is('deleted_at', null);

    if (touchResponse.error) {
      throw new Error(touchResponse.error.message);
    }

    return existingResponse.data.id;
  }

  const response = await input.supabase
    .from('activity_feed_items')
    .upsert(row, { onConflict: 'recipient_profile_id,dedupe_key' })
    .select('id')
    .single<{ id: string }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data.id;
}

async function attachGroupMember(
  supabase: SupabaseServiceClient,
  orgId: string,
  groupId: string,
  itemId: string,
) {
  const response = await supabase.from('activity_feed_group_members').upsert(
    {
      org_id: orgId,
      group_id: groupId,
      item_id: itemId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,group_id,item_id' },
  );

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function incrementGroupCount(supabase: SupabaseServiceClient, groupId: string) {
  const currentResponse = await supabase
    .from('activity_feed_group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .is('deleted_at', null);

  if (currentResponse.error) {
    throw new Error(currentResponse.error.message);
  }

  const response = await supabase
    .from('activity_feed_items')
    .update({
      sub_activity_count: currentResponse.count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId);

  if (response.error) {
    throw new Error(response.error.message);
  }
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

  await enqueueNotificationDispatchJobs({
    supabase,
    event,
    recipientProfileIds,
  });
  const refs = {
    actor: null,
    object: event.object_ref ?? undefined,
    target: event.target_ref ?? undefined,
  };
  for (const recipientProfileId of recipientProfileIds) {
    const recipientTimezone =
      recipientTimezoneByProfileId.get(recipientProfileId) ?? null;
    const recipientRole = recipientRoleByProfileId.get(recipientProfileId) ?? null;
    const recipientEvent =
      event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
        ? {
            ...event,
            payload: {
              ...event.payload,
              viewerTimezone: recipientTimezone,
              viewerRole: recipientRole,
              viewerIsActor:
                Boolean(event.actor_profile_id) &&
                event.actor_profile_id === recipientProfileId,
            },
          }
        : event;
    const rendered = definition.render(recipientEvent);
    const content = {
      headline: rendered.headline,
      summary: rendered.summary,
      preview: rendered.preview,
      actionButton: rendered.actionButton,
      expandedContent: rendered.expandedContent,
      leading: rendered.leading,
    };
    const groupKey = definition.group
      ? await resolveProjectedGroupKey(supabase, event, definition)
      : null;
    const shouldSkipLeafForStartEvent =
      event.event_type === 'session.started' && Boolean(definition.group);

    if (shouldSkipLeafForStartEvent) {
      if (definition.group && groupKey) {
        const groupRendered = definition.group.renderGroup
          ? definition.group.renderGroup(recipientEvent)
          : rendered;
        await ensureGroupParent({
          supabase,
          event,
          recipientProfileId,
          groupKey,
          groupType: definition.group.groupType,
          rendered: groupRendered,
          tabKey: definition.tabKey,
          importance: definition.importance,
        });
      }
      continue;
    }

    const isActorRecipient =
      Boolean(event.actor_profile_id) && event.actor_profile_id === recipientProfileId;
    const itemId = await upsertProjectionRow(supabase, {
      org_id: event.org_id,
      recipient_profile_id: recipientProfileId,
      source_event_id: event.id,
      dedupe_key: resolveProjectedLeafDedupeKey({
        event,
        groupKey,
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
      summary: rendered.summary ?? rendered.headline.primary,
      preview: rendered.preview ?? null,
      action_button: rendered.actionButton ?? null,
      expanded_content: rendered.expandedContent ?? null,
      importance: definition.importance ?? 'normal',
      is_read: isActorRecipient,
      read_at: isActorRecipient ? event.occurred_at : null,
      metadata: rendered.metadata ?? {},
      created_at: event.occurred_at,
      updated_at: new Date().toISOString(),
      created_by: event.actor_profile_id ?? null,
      updated_by: event.actor_profile_id ?? null,
    });

    if (definition.group) {
      if (groupKey) {
        const groupRendered = definition.group.renderGroup
          ? definition.group.renderGroup(recipientEvent)
          : rendered;
        const groupId = await ensureGroupParent({
          supabase,
          event,
          recipientProfileId,
          groupKey,
          groupType: definition.group.groupType,
          rendered: groupRendered,
          tabKey: definition.tabKey,
          importance: definition.importance,
        });
        await attachGroupMember(supabase, event.org_id, groupId, itemId);
        await incrementGroupCount(supabase, groupId);
      }
    }
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
