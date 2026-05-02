import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

function resolveMessageUiThemeKey(uiDefaults: unknown): 'classic' | 'feed' | null {
  if (!uiDefaults || typeof uiDefaults !== 'object' || Array.isArray(uiDefaults)) {
    return null;
  }
  const value = (uiDefaults as { messageUiThemeKey?: unknown }).messageUiThemeKey;
  return value === 'classic' || value === 'feed' ? value : null;
}

@Injectable()
export class SpacesService {
  async list(accessToken: string, orgId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
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
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async channels(
    accessToken: string,
    orgId: string,
    profileId: string,
    accountId: string,
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data: mySpaces, error: spError } = await supabase
      .from('learning_space_participants')
      .select('learning_space_id')
      .eq('profile_id', profileId)
      .eq('org_id', orgId)
      .is('deleted_at', null);
    if (spError) throw new InternalServerErrorException(spError.message);
    if (!mySpaces?.length) return [];

    const userSpaceIds = mySpaces.map((space) => space.learning_space_id);
    const { data, error } = await supabase
      .from('learning_space_channels')
      .select(
        `
        channel_id,
        space:learning_spaces!learning_space_id(id, title, icon_key, subject, status, archived_at, deleted_at),
        channel:channels!channel_id(id, org_id, ui_theme_key, ui_defaults, updated_at)
        `,
      )
      .eq('org_id', orgId)
      .eq('is_primary', true)
      .in('learning_space_id', userSpaceIds)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);

    const learningSpaceIds = (data ?? [])
      .map((row) => (row.space as { id?: string | null } | null)?.id ?? null)
      .filter(Boolean) as string[];
    const { data: participantRows, error: participantError } = learningSpaceIds.length
      ? await supabase
          .from('learning_space_participants')
          .select(
            `
            learning_space_id,
            profile:profiles!profile_id(display_name, first_name, last_name, kind, ui_theme_key)
            `,
          )
          .in('learning_space_id', learningSpaceIds)
          .eq('org_id', orgId)
          .is('deleted_at', null)
      : { data: [], error: null };
    if (participantError)
      throw new InternalServerErrorException(participantError.message);

    const channelIds = (data ?? [])
      .map((row) => (row.channel as { id?: string | null } | null)?.id ?? null)
      .filter(Boolean) as string[];
    const [
      { data: readStateRows, error: readError },
      { data: threadReadStateRows, error: threadReadError },
    ] = channelIds.length
      ? await Promise.all([
          supabase
            .from('channel_read_state')
            .select('channel_id, unread_count')
            .eq('account_id', accountId)
            .in('channel_id', channelIds)
            .is('thread_id', null)
            .is('deleted_at', null),
          supabase
            .from('channel_read_state')
            .select('channel_id, unread_count')
            .eq('account_id', accountId)
            .in('channel_id', channelIds)
            .not('thread_id', 'is', null)
            .is('deleted_at', null),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (readError) throw new InternalServerErrorException(readError.message);
    if (threadReadError) throw new InternalServerErrorException(threadReadError.message);

    const readStateByChannelId = new Map(
      (readStateRows ?? []).map((row) => [
        row.channel_id as string,
        row.unread_count ?? 0,
      ]),
    );
    const threadUnreadByChannelId = new Map<string, number>();
    for (const row of threadReadStateRows ?? []) {
      const channelId = row.channel_id as string;
      const unreadCount = Math.max(0, row.unread_count ?? 0);
      threadUnreadByChannelId.set(
        channelId,
        (threadUnreadByChannelId.get(channelId) ?? 0) + unreadCount,
      );
    }
    const studentProfilesBySpaceId = new Map<
      string,
      Array<{ name: string; themeKey?: string | null }>
    >();
    const participantProfilesBySpaceId = new Map<
      string,
      Array<{
        name: string;
        kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
        themeKey?: string | null;
      }>
    >();
    for (const row of participantRows ?? []) {
      const spaceId = row.learning_space_id as string | null;
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      if (
        !spaceId ||
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
      if (!displayName) continue;

      const existingParticipants = participantProfilesBySpaceId.get(spaceId) ?? [];
      if (
        !existingParticipants.some(
          (participant) =>
            participant.name === displayName && participant.kind === profile.kind,
        )
      ) {
        existingParticipants.push({
          name: displayName,
          kind: profile.kind,
          themeKey: profile.ui_theme_key ?? null,
        });
        participantProfilesBySpaceId.set(spaceId, existingParticipants);
      }

      if (profile.kind !== 'child') continue;

      const existing = studentProfilesBySpaceId.get(spaceId) ?? [];
      if (existing.some((student) => student.name === displayName)) continue;

      existing.push({
        name: displayName,
        themeKey: profile.ui_theme_key ?? null,
      });
      studentProfilesBySpaceId.set(spaceId, existing);
    }

    return (data ?? [])
      .filter((row) => {
        const space = row.space as {
          id?: string | null;
          status?: string | null;
          archived_at?: string | null;
          deleted_at?: string | null;
        } | null;
        return (
          space &&
          !space.deleted_at &&
          !space.archived_at &&
          (space.status === 'active' || space.status === 'paused')
        );
      })
      .map((row) => {
        const space = row.space as {
          id?: string | null;
          title?: string | null;
          icon_key?: string | null;
          subject?: string | null;
        };
        const channel = row.channel as unknown as {
          id: string;
          org_id: string;
          updated_at: string;
          ui_theme_key?: string | null;
          ui_defaults?: unknown;
        };
        return {
          id: channel.id,
          org_id: channel.org_id,
          topic: space.title ?? null,
          description: space.subject ?? null,
          kind: 'channel',
          updated_at: channel.updated_at,
          unread_count: Math.max(0, readStateByChannelId.get(channel.id) ?? 0),
          thread_unread_count: Math.max(0, threadUnreadByChannelId.get(channel.id) ?? 0),
          last_message_text: null,
          last_message_at: null,
          last_message_sender: null,
          icon_key: space.icon_key ?? null,
          themeKey: channel.ui_theme_key ?? null,
          messageUiThemeKey: resolveMessageUiThemeKey(channel.ui_defaults) ?? 'feed',
          student_profiles: space.id
            ? (studentProfilesBySpaceId.get(space.id) ?? [])
            : [],
          participant_profiles: space.id
            ? (participantProfilesBySpaceId.get(space.id) ?? [])
            : [],
        };
      });
  }

  async participants(accessToken: string, orgId: string, spaceId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('learning_space_participants')
      .select(
        `
        learning_space_id,
        profile:profiles!profile_id(id, display_name, first_name, last_name, kind, ui_theme_key)
      `,
      )
      .eq('org_id', orgId)
      .eq('learning_space_id', spaceId)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async supportChannel(accessToken: string, orgId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('channels')
      .select('id, topic, description, icon_key, ui_theme_key, ui_defaults, updated_at')
      .eq('org_id', orgId)
      .eq('purpose', 'support')
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
