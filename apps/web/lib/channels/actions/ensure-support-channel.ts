import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withInfoPanelDisabled } from '@iconicedu/web/lib/channels/ui-defaults';

type EnsureSupportChannelInput = {
  supabase: SupabaseClient;
  orgId: string;
  creatorProfileId: string;
};

const SUPPORT_TOPIC = 'Live Support';
const SUPPORT_ICON_KEY = 'life-buoy';
const SUPPORT_THEME_KEY = 'amber';
const SUPPORT_UI_DEFAULTS = withInfoPanelDisabled({
  defaultRightPanelKey: 'channel_info',
  disabledTabs: ['members'],
});

function hasExpectedSupportUiDefaults(uiDefaults: unknown): boolean {
  if (!uiDefaults || typeof uiDefaults !== 'object') {
    return false;
  }
  const candidate = uiDefaults as {
    defaultRightPanelOpen?: unknown;
    defaultRightPanelKey?: unknown;
    disabledTabs?: unknown;
    infoPanel?: unknown;
  };
  const hasExpectedTabs =
    Array.isArray(candidate.disabledTabs) && candidate.disabledTabs.includes('members');
  const infoPanel =
    candidate.infoPanel && typeof candidate.infoPanel === 'object'
      ? (candidate.infoPanel as Record<string, unknown>)
      : null;
  const hasInfoPanelDisabled =
    infoPanel?.showHeader === false &&
    infoPanel?.showDetails === false &&
    infoPanel?.showMedia === false &&
    infoPanel?.showMembers === false &&
    infoPanel?.showQuickActions === false &&
    infoPanel?.showHiddenQuickActions === false;

  return (
    candidate.defaultRightPanelOpen === false &&
    candidate.defaultRightPanelKey === 'channel_info' &&
    hasExpectedTabs &&
    hasInfoPanelDisabled
  );
}

export async function ensureSupportChannel(
  input: EnsureSupportChannelInput,
): Promise<{ channelId: string }> {
  const existingResponse = await input.supabase
    .from('channels')
    .select(
      'id, topic, icon_key, ui_theme_key, ui_defaults, visibility, posting_policy_kind, allow_threads, allow_reactions',
    )
    .eq('org_id', input.orgId)
    .eq('purpose', 'support')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{
      id: string;
      topic?: string | null;
      icon_key?: string | null;
      ui_theme_key?: string | null;
      ui_defaults?: unknown;
      visibility?: string | null;
      posting_policy_kind?: string | null;
      allow_threads?: boolean | null;
      allow_reactions?: boolean | null;
    }>();

  if (existingResponse.error) {
    throw new Error(existingResponse.error.message);
  }

  if (existingResponse.data?.id) {
    const existing = existingResponse.data;
    const shouldUpdate =
      existing.topic !== SUPPORT_TOPIC ||
      existing.icon_key !== SUPPORT_ICON_KEY ||
      existing.ui_theme_key !== SUPPORT_THEME_KEY ||
      !hasExpectedSupportUiDefaults(existing.ui_defaults) ||
      existing.visibility !== 'public' ||
      existing.posting_policy_kind !== 'members-only' ||
      existing.allow_threads !== true ||
      existing.allow_reactions !== true;

    if (shouldUpdate) {
      const now = new Date().toISOString();
      const updateResponse = await input.supabase
        .from('channels')
        .update({
          topic: SUPPORT_TOPIC,
          icon_key: SUPPORT_ICON_KEY,
          ui_theme_key: SUPPORT_THEME_KEY,
          ui_defaults: SUPPORT_UI_DEFAULTS,
          visibility: 'public',
          posting_policy_kind: 'members-only',
          allow_threads: true,
          allow_reactions: true,
          updated_at: now,
          updated_by: input.creatorProfileId,
        })
        .eq('id', existing.id)
        .eq('org_id', input.orgId)
        .is('deleted_at', null);

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }
    }

    return { channelId: existing.id };
  }

  const now = new Date().toISOString();
  const channelId = randomUUID();
  const insertResponse = await input.supabase.from('channels').insert({
    id: channelId,
    org_id: input.orgId,
    kind: 'channel',
    topic: SUPPORT_TOPIC,
    description: 'ICONIC support channel for questions and threaded replies.',
    icon_key: SUPPORT_ICON_KEY,
    ui_theme_key: SUPPORT_THEME_KEY,
    ui_defaults: SUPPORT_UI_DEFAULTS,
    visibility: 'public',
    purpose: 'support',
    status: 'active',
    posting_policy_kind: 'members-only',
    allow_threads: true,
    allow_reactions: true,
    created_by_profile_id: input.creatorProfileId,
    created_at: now,
    created_by: input.creatorProfileId,
    updated_at: now,
    updated_by: input.creatorProfileId,
  });

  if (insertResponse.error) {
    throw new Error(insertResponse.error.message);
  }

  return { channelId };
}
