import { supabase } from '@/lib/supabase/client';
import type { ChannelListItem, DmParticipant } from '@/lib/api/types';

type LastMessageInfo = { text: string | null; at: string | null; sender: string | null };

const PREVIEW_LABELS: Record<string, string> = {
  image: 'Image',
  file: 'File',
  'audio-recording': 'Voice message',
  'lesson-assignment': 'Assignment',
  'homework-submission': 'Homework submitted',
  'progress-update': 'Progress update',
  'event-reminder': 'Event reminder',
  'session-summary': 'Session summary',
  'session-complete': 'Session complete',
  'session-booking': 'Session booked',
  'payment-reminder': 'Payment reminder',
  'feedback-request': 'Feedback request',
};

export async function fetchLastMessages(
  channelIds: string[],
): Promise<Map<string, LastMessageInfo>> {
  if (!channelIds.length) return new Map();

  type MsgRow = {
    id: string;
    channel_id: string;
    type: string;
    created_at: string;
    sender: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };

  const { data: msgRows } = await supabase
    .from('messages')
    .select(
      'id, channel_id, type, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name)',
    )
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .limit(channelIds.length * 3);

  if (!msgRows?.length) return new Map();

  const rows = msgRows as unknown as MsgRow[];
  const latestByChannel = new Map<string, MsgRow>();
  for (const row of rows) {
    if (!latestByChannel.has(row.channel_id)) {
      latestByChannel.set(row.channel_id, row);
    }
  }

  const textMessageIds = Array.from(latestByChannel.values())
    .filter((row) => row.type === 'text')
    .map((row) => row.id);

  const textByMessageId = new Map<string, string>();
  if (textMessageIds.length) {
    const { data: textRows } = await supabase
      .from('message_text')
      .select('message_id, payload')
      .in('message_id', textMessageIds);

    for (const row of textRows ?? []) {
      const text = (
        (row.payload as Record<string, unknown>)?.text as string | undefined
      )?.trim();
      if (text) textByMessageId.set(row.message_id, text);
    }
  }

  const result = new Map<string, LastMessageInfo>();
  for (const [channelId, row] of latestByChannel) {
    const text =
      row.type === 'text'
        ? (textByMessageId.get(row.id) ?? null)
        : (PREVIEW_LABELS[row.type] ?? null);
    const sender = row.sender
      ? row.sender.display_name?.trim() ||
        [row.sender.first_name, row.sender.last_name].filter(Boolean).join(' ') ||
        null
      : null;
    result.set(channelId, { text, at: row.created_at, sender });
  }

  return result;
}

export async function fetchDirectMessages(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
): Promise<ChannelListItem[]> {
  if (!myProfileId || !myAccountId) return [];

  const { data: myMemberships, error: myError } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('profile_id', myProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (myError) throw myError;
  if (!myMemberships?.length) return [];

  const userChannelIds = myMemberships.map((membership) => membership.channel_id);

  const { data: chRows, error: chError } = await supabase
    .from('channels')
    .select('id, org_id, topic, description, kind, updated_at')
    .in('id', userChannelIds)
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (chError) throw chError;
  if (!chRows?.length) return [];

  const { data: memberRows } = await supabase
    .from('channel_members')
    .select(
      'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, kind)',
    )
    .in(
      'channel_id',
      chRows.map((channel) => channel.id),
    )
    .is('deleted_at', null);

  const { data: readStateRows } = await supabase
    .from('channel_read_state')
    .select('channel_id, unread_count')
    .eq('account_id', myAccountId)
    .in(
      'channel_id',
      chRows.map((channel) => channel.id),
    )
    .is('deleted_at', null);

  const readStateByChannelId = new Map(
    (readStateRows ?? []).map((row) => [row.channel_id as string, row.unread_count ?? 0]),
  );

  const participantMap = new Map<string, DmParticipant[]>();
  for (const member of memberRows ?? []) {
    const profile = member.profile as unknown as DmParticipant | null;
    if (!profile || profile.id === myProfileId) continue;
    const list = participantMap.get(member.channel_id) ?? [];
    list.push(profile);
    participantMap.set(member.channel_id, list);
  }

  const lastMessages = await fetchLastMessages(chRows.map((channel) => channel.id));

  return chRows.map((channel) => {
    const last = lastMessages.get(channel.id);
    return {
      id: channel.id,
      org_id: channel.org_id,
      topic: channel.topic ?? null,
      description: channel.description ?? null,
      kind: channel.kind,
      updated_at: channel.updated_at,
      unread_count: Math.max(0, readStateByChannelId.get(channel.id) ?? 0),
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
      participants: participantMap.get(channel.id) ?? [],
    };
  });
}

export async function fetchSupervisedDirectMessages(
  orgId: string,
  guardianAccountId: string,
  guardianProfileId: string,
): Promise<ChannelListItem[]> {
  if (!orgId || !guardianAccountId || !guardianProfileId) return [];

  const { data: links } = await supabase
    .from('family_links')
    .select('child_account_id')
    .eq('guardian_account_id', guardianAccountId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (!links?.length) return [];

  const childAccountIds = links
    .map((link: { child_account_id: string }) => link.child_account_id)
    .filter(Boolean);

  const { data: childProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, account_id')
    .in('account_id', childAccountIds)
    .is('deleted_at', null);

  if (!childProfiles?.length) return [];

  const { data: guardianMemberships } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('profile_id', guardianProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  const guardianChannelIds = new Set(
    (guardianMemberships ?? []).map(
      (membership: { channel_id: string }) => membership.channel_id,
    ),
  );

  const results: ChannelListItem[] = [];

  for (const child of childProfiles as Array<{
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    account_id: string;
  }>) {
    const childName =
      child.display_name?.trim() ||
      [child.first_name, child.last_name].filter(Boolean).join(' ').trim() ||
      'Child';

    const { data: childMemberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('profile_id', child.id)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    const childOnlyChannelIds = (childMemberships ?? [])
      .map((membership: { channel_id: string }) => membership.channel_id)
      .filter((id: string) => !guardianChannelIds.has(id));

    if (!childOnlyChannelIds.length) continue;

    const { data: chRows } = await supabase
      .from('channels')
      .select('id, org_id, topic, description, kind, updated_at')
      .in('id', childOnlyChannelIds)
      .eq('org_id', orgId)
      .eq('kind', 'dm')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (!chRows?.length) continue;

    const { data: readStateRows } = await supabase
      .from('channel_read_state')
      .select('channel_id, unread_count')
      .eq('account_id', child.account_id)
      .in(
        'channel_id',
        chRows.map((channel: { id: string }) => channel.id),
      )
      .is('deleted_at', null);

    const readStateByChannelId = new Map(
      (readStateRows ?? []).map((row) => [
        row.channel_id as string,
        row.unread_count ?? 0,
      ]),
    );

    const { data: memberRows } = await supabase
      .from('channel_members')
      .select(
        'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, kind)',
      )
      .in(
        'channel_id',
        chRows.map((channel: { id: string }) => channel.id),
      )
      .is('deleted_at', null);

    const participantsMap = new Map<string, DmParticipant[]>();
    for (const member of memberRows ?? []) {
      const row = member as {
        channel_id: string;
        profile_id: string;
        profile: DmParticipant | DmParticipant[] | null;
      };
      if (row.profile_id === child.id) continue;
      const profile = Array.isArray(row.profile) ? (row.profile[0] ?? null) : row.profile;
      if (!profile) continue;
      const list = participantsMap.get(row.channel_id) ?? [];
      list.push(profile);
      participantsMap.set(row.channel_id, list);
    }

    for (const channel of chRows as Array<{
      id: string;
      org_id: string;
      topic: string | null;
      description: string | null;
      kind: string;
      updated_at: string;
    }>) {
      results.push({
        id: channel.id,
        org_id: channel.org_id,
        topic: channel.topic ?? null,
        description: channel.description ?? null,
        kind: channel.kind,
        updated_at: channel.updated_at,
        unread_count: Math.max(0, readStateByChannelId.get(channel.id) ?? 0),
        last_message_text: null,
        last_message_at: null,
        last_message_sender: null,
        participants: participantsMap.get(channel.id) ?? [],
        is_supervised: true,
        supervised_child_name: childName,
      });
    }
  }

  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.id)) return false;
    seen.add(result.id);
    return true;
  });
}

export async function findDirectMessageChannelForProfiles(
  orgId: string,
  currentProfileId: string,
  targetProfileId: string,
): Promise<{
  channelId: string;
  topic: string;
  avatarSeed: string | null;
  avatarUrl: string | null;
  avatarRole: string | null;
  avatarTimezone: string | null;
} | null> {
  if (
    !orgId ||
    !currentProfileId ||
    !targetProfileId ||
    currentProfileId === targetProfileId
  ) {
    return null;
  }

  const [
    { data: currentMemberships, error: currentError },
    { data: targetMemberships, error: targetError },
  ] = await Promise.all([
    supabase
      .from('channel_members')
      .select('channel_id')
      .eq('org_id', orgId)
      .eq('profile_id', currentProfileId)
      .is('deleted_at', null),
    supabase
      .from('channel_members')
      .select('channel_id')
      .eq('org_id', orgId)
      .eq('profile_id', targetProfileId)
      .is('deleted_at', null),
  ]);

  if (currentError) throw currentError;
  if (targetError) throw targetError;

  const currentChannelIds = new Set(
    (currentMemberships ?? []).map((row) => row.channel_id as string),
  );
  const sharedChannelIds = (targetMemberships ?? [])
    .map((row) => row.channel_id as string)
    .filter((channelId) => currentChannelIds.has(channelId));

  if (!sharedChannelIds.length) return null;

  const [
    { data: channels, error: channelsError },
    { data: targetProfile, error: profileError },
  ] = await Promise.all([
    supabase
      .from('channels')
      .select('id, updated_at')
      .eq('org_id', orgId)
      .eq('kind', 'dm')
      .eq('status', 'active')
      .in('id', sharedChannelIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('profiles')
      .select(
        'id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, kind',
      )
      .eq('id', targetProfileId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (channelsError) throw channelsError;
  if (profileError) throw profileError;

  const channel = channels?.[0];
  if (!channel || !targetProfile) return null;

  const topic =
    targetProfile.display_name?.trim() ||
    [targetProfile.first_name, targetProfile.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Direct Message';

  return {
    channelId: channel.id,
    topic,
    avatarSeed: (targetProfile.avatar_seed as string | null) ?? targetProfile.id,
    avatarUrl: (targetProfile.avatar_url as string | null) ?? null,
    avatarRole: (targetProfile.kind as string | null) ?? null,
    avatarTimezone: (targetProfile.timezone as string | null) ?? null,
  };
}

export async function fetchChannels(orgId: string): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_read_state(unread_count)
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'channel')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const lastMessages = await fetchLastMessages(data.map((channel) => channel.id));

  return data.map((channel) => {
    const readState = (
      channel.channel_read_state as Array<{ unread_count: number | null }> | null
    )?.[0];
    const last = lastMessages.get(channel.id);
    return {
      id: channel.id,
      org_id: channel.org_id,
      topic: channel.topic,
      description: channel.description,
      kind: channel.kind,
      updated_at: channel.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
    };
  });
}

export async function fetchNotificationPreferences(orgId: string, profileId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFamilyLinks(orgId: string, guardianAccountId: string) {
  const { data, error } = await supabase
    .from('family_links')
    .select('*')
    .eq('org_id', orgId)
    .eq('guardian_account_id', guardianAccountId)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfilesByAccountIds(orgId: string, accountIds: string[]) {
  if (!accountIds.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, org_id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, status, ui_theme_key',
    )
    .eq('org_id', orgId)
    .in('account_id', accountIds)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}
