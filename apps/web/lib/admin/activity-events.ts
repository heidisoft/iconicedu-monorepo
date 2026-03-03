import type { ActivityEventRow, ProfileRow } from '@iconicedu/shared-types';

import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type AdminActivityEventRow = ActivityEventRow & {
  actorDisplayName: string | null;
  scopeLabel: string;
  objectLabel: string | null;
  targetLabel: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toDisplayName(profile: ProfileRow): string {
  const display = profile.display_name?.trim() ?? '';
  if (display) {
    return display;
  }
  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return 'User';
}

function describeRecord(value: Record<string, unknown>): string | null {
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (label) {
    return label;
  }
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (title) {
    return title;
  }
  const topic = typeof value.topic === 'string' ? value.topic.trim() : '';
  if (topic) {
    return topic;
  }
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (name) {
    return name;
  }
  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (kind && id) {
    return `${kind}:${id}`;
  }
  if (kind) {
    return kind;
  }
  if (id) {
    return id;
  }
  return null;
}

function describeScope(scope: Record<string, unknown>): string {
  const label = typeof scope.label === 'string' ? scope.label.trim() : '';
  if (label) {
    return label;
  }

  const kind = typeof scope.kind === 'string' ? scope.kind.trim() : '';
  if (kind === 'learning_space') {
    const learningSpaceId =
      typeof scope.learningSpaceId === 'string' ? scope.learningSpaceId : null;
    return learningSpaceId ? `learning_space:${learningSpaceId}` : 'learning_space';
  }
  if (kind === 'channel') {
    const channelId = typeof scope.channelId === 'string' ? scope.channelId : null;
    return channelId ? `channel:${channelId}` : 'channel';
  }
  if (kind === 'direct') {
    return 'direct';
  }
  if (kind === 'org') {
    return 'org';
  }

  return kind || 'unknown';
}

function resolveActorDisplayName(
  event: ActivityEventRow,
  profilesById: Map<string, ProfileRow>,
): string | null {
  if (event.actor_profile_id) {
    const profile = profilesById.get(event.actor_profile_id);
    if (profile) {
      return toDisplayName(profile);
    }
  }

  if (event.source_kind === 'system') {
    return 'System';
  }

  if (event.source_kind === 'integration') {
    return 'Integration';
  }

  if (event.source_kind === 'provider_webhook') {
    return 'Provider webhook';
  }

  return null;
}

export async function getAdminActivityEventRows(
  orgId: string,
  options: { limit?: number } = {},
): Promise<AdminActivityEventRow[]> {
  if (!orgId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('activity_events')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(options.limit ?? 200)
    .returns<ActivityEventRow[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = response.data ?? [];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_profile_id).filter((value): value is string => Boolean(value))),
  );
  const profilesResponse = await getProfilesByIds(supabase, orgId, actorIds);
  const profilesById = new Map(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const objectRef = asRecord(row.object_ref);
    const targetRef = asRecord(row.target_ref);

    return {
      ...row,
      actorDisplayName: resolveActorDisplayName(row, profilesById),
      scopeLabel: describeScope(asRecord(row.scope)),
      objectLabel: describeRecord(objectRef),
      targetLabel: describeRecord(targetRef),
    };
  });
}
