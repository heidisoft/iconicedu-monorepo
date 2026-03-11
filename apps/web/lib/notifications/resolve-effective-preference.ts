import type { NotificationDeliveryChannel } from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const ALLOWED_CHANNELS: NotificationDeliveryChannel[] = ['push', 'email', 'sms'];

type PreferenceRow = {
  channels: string[] | null;
  muted?: boolean | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeDeliveryChannels(channels: string[] | null | undefined) {
  if (!Array.isArray(channels)) {
    return [] as NotificationDeliveryChannel[];
  }

  return channels
    .map((channel) => (channel === 'text' ? 'sms' : channel))
    .filter((channel): channel is NotificationDeliveryChannel =>
      ALLOWED_CHANNELS.includes(channel as NotificationDeliveryChannel),
    );
}

function resolveScopedEventTarget(
  event: ActivityEventRow,
): { scopeKind: 'channel' | 'learning_space'; scopeId: string } | null {
  const scope = asRecord(event.scope);
  const scopeKind = scope.kind;
  if (scopeKind === 'channel' && typeof scope.channelId === 'string') {
    return { scopeKind: 'channel', scopeId: scope.channelId };
  }
  if (scopeKind === 'learning_space' && typeof scope.learningSpaceId === 'string') {
    return { scopeKind: 'learning_space', scopeId: scope.learningSpaceId };
  }
  return null;
}

export async function resolveEffectivePreference(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  recipientProfileId: string;
  defaultChannels: NotificationDeliveryChannel[];
}) {
  const scopedTarget = resolveScopedEventTarget(input.event);

  const scopedPreferencePromise = scopedTarget
    ? input.supabase
        .from('notification_preference_scopes')
        .select('channels, muted')
        .eq('org_id', input.event.org_id)
        .eq('profile_id', input.recipientProfileId)
        .eq('scope_kind', scopedTarget.scopeKind)
        .eq('scope_id', scopedTarget.scopeId)
        .eq('pref_key', input.event.event_type)
        .is('deleted_at', null)
        .maybeSingle<PreferenceRow>()
    : Promise.resolve({ data: null, error: null });

  const globalPreferencePromise = input.supabase
    .from('notification_preferences')
    .select('channels, muted')
    .eq('org_id', input.event.org_id)
    .eq('profile_id', input.recipientProfileId)
    .eq('pref_key', input.event.event_type)
    .is('deleted_at', null)
    .maybeSingle<PreferenceRow>();

  const [scopedResponse, globalResponse] = await Promise.all([
    scopedPreferencePromise,
    globalPreferencePromise,
  ]);

  if (scopedResponse.error) {
    throw new Error(scopedResponse.error.message);
  }
  if (globalResponse.error) {
    throw new Error(globalResponse.error.message);
  }

  const scoped = scopedResponse.data;
  const global = globalResponse.data;
  const source = scoped
    ? 'scoped_preference'
    : global
      ? 'global_preference'
      : 'system_default';
  const effective = scoped ?? global;
  const muted = Boolean(effective?.muted);
  const channels = effective
    ? normalizeDeliveryChannels(effective.channels)
    : input.defaultChannels;

  return {
    source,
    muted,
    channels,
    scopeKind: scopedTarget?.scopeKind ?? null,
    scopeId: scopedTarget?.scopeId ?? null,
  };
}
