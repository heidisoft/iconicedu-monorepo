import { apiGet } from '@/lib/api/http-client';
import { supabase } from '@/lib/supabase/client';
import type { ChannelListItem } from '@/lib/api/types';

export async function fetchLearningSpaces(orgId: string) {
  return apiGet<Record<string, unknown>[]>('/spaces', { orgId });
}

export async function fetchSpaceChannelMetaByChannelId(channelId: string): Promise<{
  title: string | null;
  subtitle: string | null;
  iconKey: string | null;
  themeKey: string | null;
  description: string | null;
  liveSession: {
    enabled: boolean;
    provider: 'daily' | 'zoom' | 'jitsi' | 'custom';
    mode: 'video' | 'audio' | null;
    joinUrl: string | null;
  } | null;
  studentProfiles: Array<{ name: string; themeKey?: string | null }>;
  participantProfiles: Array<{
    name: string;
    kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
    themeKey?: string | null;
  }>;
  messageUiThemeKey?: 'classic' | 'feed' | null;
} | null> {
  if (!channelId) return null;

  const { data, error } = await supabase
    .from('learning_space_channels')
    .select(
      `
      space:learning_spaces!learning_space_id(
        id,
        title,
        subject,
        icon_key,
        description,
        deleted_at
      ),
      channel:channels!channel_id(ui_theme_key, ui_defaults, live_session_config)
    `,
    )
    .eq('channel_id', channelId)
    .eq('is_primary', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;

  const space = data?.space as
    | {
        id: string;
        title: string | null;
        subject: string | null;
        icon_key: string | null;
        description: string | null;
        deleted_at: string | null;
      }
    | null
    | undefined;
  const channel = data?.channel as
    | {
        ui_theme_key: string | null;
        ui_defaults?: { messageUiThemeKey?: unknown } | null;
        live_session_config?: unknown;
      }
    | null
    | undefined;

  if (!space || space.deleted_at) return null;

  const { data: participantRows, error: participantError } = await supabase
    .from('learning_space_participants')
    .select(
      `
      profile:profiles!profile_id(display_name, first_name, last_name, kind, ui_theme_key)
    `,
    )
    .eq('learning_space_id', space.id)
    .is('deleted_at', null);

  if (participantError) throw participantError;

  const studentProfiles: Array<{ name: string; themeKey?: string | null }> = [];
  const participantProfiles: Array<{
    name: string;
    kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
    themeKey?: string | null;
  }> = [];
  for (const row of participantRows ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (
      !profile ||
      (profile.kind !== 'educator' &&
        profile.kind !== 'guardian' &&
        profile.kind !== 'child' &&
        profile.kind !== 'staff' &&
        profile.kind !== 'system')
    ) {
      continue;
    }
    const displayName =
      profile.display_name?.trim() ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (
      displayName &&
      !participantProfiles.some(
        (participant) =>
          participant.name === displayName && participant.kind === profile.kind,
      )
    ) {
      participantProfiles.push({
        name: displayName,
        kind: profile.kind,
        themeKey: profile.ui_theme_key ?? null,
      });
    }
    if (
      profile.kind === 'child' &&
      displayName &&
      !studentProfiles.some((student) => student.name === displayName)
    ) {
      studentProfiles.push({
        name: displayName,
        themeKey: profile.ui_theme_key ?? null,
      });
    }
  }

  const liveSessionConfig = (() => {
    const value = channel?.live_session_config;
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.enabled !== true || typeof candidate.provider !== 'string') {
      return null;
    }
    if (
      candidate.provider !== 'daily' &&
      candidate.provider !== 'zoom' &&
      candidate.provider !== 'jitsi' &&
      candidate.provider !== 'custom'
    ) {
      return null;
    }
    const mode =
      candidate.mode === 'video' || candidate.mode === 'audio'
        ? (candidate.mode as 'video' | 'audio')
        : null;
    const joinUrl =
      typeof candidate.joinUrl === 'string' && candidate.joinUrl.trim().length > 0
        ? candidate.joinUrl.trim()
        : null;
    return {
      enabled: true,
      provider: candidate.provider as 'daily' | 'zoom' | 'jitsi' | 'custom',
      mode,
      joinUrl,
    };
  })();

  return {
    title: space.title ?? null,
    subtitle: space.subject ?? null,
    iconKey: space.icon_key ?? null,
    themeKey: channel?.ui_theme_key ?? null,
    messageUiThemeKey:
      channel?.ui_defaults?.messageUiThemeKey === 'classic' ||
      channel?.ui_defaults?.messageUiThemeKey === 'feed'
        ? channel.ui_defaults.messageUiThemeKey
        : 'feed',
    description: space.description ?? null,
    liveSession: liveSessionConfig,
    studentProfiles,
    participantProfiles,
  };
}

export async function fetchSupportChannel(orgId: string): Promise<{
  id: string;
  topic: string | null;
  description: string | null;
  icon_key?: string | null;
  themeKey?: string | null;
  messageUiThemeKey?: 'classic' | 'feed' | null;
  updated_at?: string | null;
} | null> {
  const data = await apiGet<{
    id: string;
    topic: string | null;
    description: string | null;
    icon_key?: string | null;
    ui_theme_key?: string | null;
    ui_defaults?: { messageUiThemeKey?: unknown } | null;
    updated_at?: string | null;
  } | null>('/spaces/support-channel', { orgId });
  if (!data) return null;
  return {
    id: data.id,
    topic: data.topic ?? null,
    description: data.description ?? null,
    icon_key: data.icon_key ?? null,
    themeKey: data.ui_theme_key ?? null,
    messageUiThemeKey:
      data.ui_defaults?.messageUiThemeKey === 'classic' ||
      data.ui_defaults?.messageUiThemeKey === 'feed'
        ? data.ui_defaults.messageUiThemeKey
        : 'feed',
    updated_at: data.updated_at ?? null,
  };
}

export async function fetchLearningSpaceChannels(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
  myProfileKind?: string | null,
): Promise<ChannelListItem[]> {
  const items = await apiGet<ChannelListItem[]>('/spaces/channels', {
    orgId,
    profileId: myProfileId,
    accountId: myAccountId,
    profileKind: myProfileKind ?? undefined,
  });
  const spaceItems = items.map((item) => ({
    ...item,
    is_learning_space: item.is_learning_space ?? true,
    student_profiles: item.student_profiles ?? [],
    participant_profiles: item.participant_profiles ?? [],
  }));
  if (myProfileKind === 'child') return spaceItems;

  const supportChannel = await fetchSupportChannel(orgId);
  if (!supportChannel) return spaceItems;

  return [
    ...spaceItems,
    {
      id: supportChannel.id,
      org_id: orgId,
      topic: supportChannel.topic ?? 'Support',
      description: supportChannel.description ?? null,
      kind: 'channel',
      updated_at: supportChannel.updated_at ?? new Date(0).toISOString(),
      unread_count: 0,
      thread_unread_count: 0,
      last_message_text: null,
      last_message_at: null,
      last_message_sender: null,
      icon_key: supportChannel.icon_key ?? 'life-buoy',
      themeKey: supportChannel.themeKey ?? null,
      messageUiThemeKey: supportChannel.messageUiThemeKey ?? 'feed',
      student_name: null,
      student_profiles: [],
      participant_profiles: [],
      is_learning_space: false,
      is_support: true,
    },
  ];
}
