import type { NotificationDeliveryChannel } from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const ALLOWED_CHANNELS: NotificationDeliveryChannel[] = ['push', 'email', 'sms'];

type PreferenceRow = {
  channels: string[] | null;
  muted?: boolean | null;
};

type ScopedPreferenceRow = PreferenceRow & {
  mode?: string | null;
  muted_until?: string | null;
};

/** Resolves a scoped preference row's mode/muted_until into an effective muted + mentions-only state. */
function resolveScopedMuteState(row: ScopedPreferenceRow): {
  muted: boolean;
  mentionsOnly: boolean;
} {
  const mode = row.mode ?? (row.muted ? 'muted_until_enabled' : 'normal');
  switch (mode) {
    case 'muted_until_enabled':
      return { muted: true, mentionsOnly: false };
    case 'muted_until': {
      const mutedUntilMs = row.muted_until ? Date.parse(row.muted_until) : Number.NaN;
      const stillMuted = !Number.isNaN(mutedUntilMs) && mutedUntilMs > Date.now();
      return { muted: stillMuted, mentionsOnly: false };
    }
    case 'mentions_only':
      return { muted: false, mentionsOnly: true };
    default:
      return { muted: Boolean(row.muted), mentionsOnly: false };
  }
}

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
  prefKey?: string;
  defaultChannels: NotificationDeliveryChannel[];
}) {
  const scopedTarget = resolveScopedEventTarget(input.event);
  const prefKey = input.prefKey ?? input.event.event_type;

  const scopedPreferencePromise = scopedTarget
    ? input.supabase
        .from('notification_preference_scopes')
        .select('channels, muted, mode, muted_until')
        .eq('org_id', input.event.org_id)
        .eq('profile_id', input.recipientProfileId)
        .eq('scope_kind', scopedTarget.scopeKind)
        .eq('scope_id', scopedTarget.scopeId)
        .eq('pref_key', prefKey)
        .is('deleted_at', null)
        .maybeSingle<ScopedPreferenceRow>()
    : Promise.resolve({ data: null, error: null });

  const globalPreferencePromise = input.supabase
    .from('notification_preferences')
    .select('channels, muted')
    .eq('org_id', input.event.org_id)
    .eq('profile_id', input.recipientProfileId)
    .eq('pref_key', prefKey)
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

  const scoped = scopedResponse.data as ScopedPreferenceRow | null;
  const global = globalResponse.data;
  const source = scoped
    ? 'scoped_preference'
    : global
      ? 'global_preference'
      : 'system_default';
  const effective = scoped ?? global;
  const { muted, mentionsOnly } = scoped
    ? resolveScopedMuteState(scoped)
    : { muted: Boolean(global?.muted), mentionsOnly: false };
  const channels = effective
    ? normalizeDeliveryChannels(effective.channels)
    : input.defaultChannels;

  return {
    source,
    muted,
    mentionsOnly,
    channels,
    scopeKind: scopedTarget?.scopeKind ?? null,
    scopeId: scopedTarget?.scopeId ?? null,
  };
}
