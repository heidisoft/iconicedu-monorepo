import { supabase } from '@/lib/supabase/client';
import { fetchLastMessages } from '@/lib/api/channel/queries';
import type { ChannelListItem } from '@/lib/api/types';

export async function fetchLearningSpaces(orgId: string) {
  const { data, error } = await supabase
    .from('learning_spaces')
    .select(
      `
      id, org_id, kind, status, title, icon_key, subject, description, updated_at,
      learning_space_channels(channel_id, is_primary, channel:channels!channel_id(*))
    `,
    )
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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
      channel:channels!channel_id(ui_theme_key, live_session_config)
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
    | { ui_theme_key: string | null; live_session_config?: unknown }
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
  for (const row of participantRows ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (!profile || profile.kind !== 'child') continue;
    const displayName =
      profile.display_name?.trim() ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (displayName && !studentProfiles.some((student) => student.name === displayName)) {
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
    description: space.description ?? null,
    liveSession: liveSessionConfig,
    studentProfiles,
  };
}

export async function fetchSupportChannel(orgId: string): Promise<{
  id: string;
  topic: string | null;
  description: string | null;
  icon_key?: string | null;
  themeKey?: string | null;
  updated_at?: string | null;
} | null> {
  const { data, error } = await supabase
    .from('channels')
    .select('id, topic, description, icon_key, ui_theme_key, updated_at')
    .eq('org_id', orgId)
    .eq('purpose', 'support')
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    topic: data.topic ?? null,
    description: data.description ?? null,
    icon_key: data.icon_key ?? null,
    themeKey: data.ui_theme_key ?? null,
    updated_at: data.updated_at ?? null,
  };
}

export async function fetchLearningSpaceChannels(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
  myProfileKind?: string | null,
): Promise<ChannelListItem[]> {
  if (!myProfileId || !myAccountId) return [];

  const { data: mySpaces, error: spError } = await supabase
    .from('learning_space_participants')
    .select('learning_space_id')
    .eq('profile_id', myProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (spError) throw spError;
  if (!mySpaces?.length) return [];

  const userSpaceIds = mySpaces.map((space) => space.learning_space_id);

  const { data, error } = await supabase
    .from('learning_space_channels')
    .select(
      `
      channel_id,
      space:learning_spaces!learning_space_id(id, title, icon_key, subject, status, deleted_at),
      channel:channels!channel_id(id, org_id, ui_theme_key, updated_at)
      `,
    )
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .in('learning_space_id', userSpaceIds)
    .is('deleted_at', null);

  if (error) throw error;

  type Row = typeof data extends (infer R)[] | null ? R : never;
  const toSpace = (row: Row) =>
    row.space as unknown as {
      id: string;
      title: string;
      icon_key: string | null;
      subject: string | null;
      status: string;
      deleted_at: string | null;
    } | null;
  const toChannel = (row: Row) =>
    row.channel as unknown as {
      id: string;
      org_id: string;
      ui_theme_key: string | null;
      updated_at: string;
    } | null;

  const channelIds = (data ?? [])
    .map((row) => toChannel(row)?.id ?? null)
    .filter(Boolean) as string[];
  const learningSpaceIds = (data ?? [])
    .map((row) => toSpace(row)?.id ?? null)
    .filter(Boolean) as string[];

  const { data: readStateRows } = channelIds.length
    ? await supabase
        .from('channel_read_state')
        .select('channel_id, unread_count')
        .eq('account_id', myAccountId)
        .in('channel_id', channelIds)
        .is('deleted_at', null)
    : { data: [] as Array<{ channel_id: string; unread_count: number | null }> };

  const readStateByChannelId = new Map(
    (readStateRows ?? []).map((row) => [row.channel_id as string, row.unread_count ?? 0]),
  );

  const { data: participantRows } = learningSpaceIds.length
    ? await supabase
        .from('learning_space_participants')
        .select(
          `
          learning_space_id,
          profile:profiles!profile_id(display_name, first_name, last_name, kind, ui_theme_key)
          `,
        )
        .eq('org_id', orgId)
        .in('learning_space_id', learningSpaceIds)
        .is('deleted_at', null)
    : {
        data: [] as Array<{
          learning_space_id: string;
          profile: {
            display_name: string | null;
            first_name: string | null;
            last_name: string | null;
            kind: string | null;
            ui_theme_key: string | null;
          } | null;
        }>,
      };

  const studentProfilesBySpaceId = new Map<
    string,
    Array<{ name: string; themeKey?: string | null }>
  >();
  for (const row of participantRows ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (!profile || profile.kind !== 'child') continue;
    const displayName =
      profile.display_name?.trim() ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (!displayName) continue;
    const list = studentProfilesBySpaceId.get(row.learning_space_id) ?? [];
    if (!list.some((item) => item.name === displayName)) {
      list.push({ name: displayName, themeKey: profile.ui_theme_key ?? null });
      studentProfilesBySpaceId.set(row.learning_space_id, list);
    }
  }

  const items = (data ?? [])
    .filter((row) => {
      const space = toSpace(row);
      const channel = toChannel(row);
      return (
        space &&
        channel &&
        !space.deleted_at &&
        (space.status === 'active' || space.status === 'paused')
      );
    })
    .map((row) => {
      const space = toSpace(row)!;
      const channel = toChannel(row)!;
      return {
        id: channel.id,
        org_id: channel.org_id,
        topic: space.title,
        description: space.subject ?? null,
        kind: 'channel' as const,
        updated_at: channel.updated_at,
        unread_count: Math.max(0, readStateByChannelId.get(channel.id) ?? 0),
        last_message_text: null as string | null,
        last_message_at: null as string | null,
        last_message_sender: null as string | null,
        icon_key: space.icon_key ?? null,
        themeKey: channel.ui_theme_key ?? null,
        student_name: null,
        student_profiles: studentProfilesBySpaceId.get(space.id) ?? [],
        is_support: false,
      };
    });

  const supportChannel =
    myProfileKind === 'child' ? null : await fetchSupportChannel(orgId);
  const supportItems: ChannelListItem[] = supportChannel
    ? [
        {
          id: supportChannel.id,
          org_id: orgId,
          topic: supportChannel.topic ?? 'Support',
          description: supportChannel.description ?? null,
          kind: 'channel',
          updated_at: supportChannel.updated_at ?? new Date(0).toISOString(),
          unread_count: 0,
          last_message_text: null,
          last_message_at: null,
          last_message_sender: null,
          icon_key: supportChannel.icon_key ?? 'life-buoy',
          themeKey: supportChannel.themeKey ?? null,
          student_name: null,
          student_profiles: [],
          is_support: true,
        },
      ]
    : [];

  const allItems = [...items, ...supportItems];
  const allChannelIds = allItems.map((item) => item.id);

  const supportReadStateRows = supportItems.length
    ? await supabase
        .from('channel_read_state')
        .select('channel_id, unread_count')
        .eq('account_id', myAccountId)
        .in(
          'channel_id',
          supportItems.map((item) => item.id),
        )
        .is('deleted_at', null)
    : { data: [] as Array<{ channel_id: string; unread_count: number | null }> };

  const mergedReadStateByChannelId = new Map(readStateByChannelId);
  for (const row of supportReadStateRows.data ?? []) {
    mergedReadStateByChannelId.set(row.channel_id as string, row.unread_count ?? 0);
  }

  const lastMessages = await fetchLastMessages(allChannelIds);

  return allItems.map((item) => {
    const last = lastMessages.get(item.id);
    return {
      ...item,
      unread_count: Math.max(
        0,
        mergedReadStateByChannelId.get(item.id) ?? item.unread_count,
      ),
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
    };
  });
}
