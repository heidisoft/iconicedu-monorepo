import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@iconicedu/api/prisma/prisma.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { ThreadsService } from '@iconicedu/api/modules/threads/threads.service';

type DmParticipant = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  timezone?: string | null;
  city?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  kind?: string | null;
};

type ChannelListItem = {
  id: string;
  org_id: string;
  topic: string | null;
  description: string | null;
  kind: string;
  updated_at: string;
  unread_count: number;
  thread_unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  icon_key?: string | null;
  themeKey?: string | null;
  participants?: DmParticipant[];
  is_supervised?: boolean;
  supervised_child_name?: string | null;
};

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

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
  ) {}

  private async fetchLastMessages(
    accessToken: string,
    channelIds: string[],
  ): Promise<Map<string, LastMessageInfo>> {
    if (!channelIds.length) return new Map();
    const supabase = createSupabaseSessionClient(accessToken);

    const { data: msgRows, error } = await supabase
      .from('messages')
      .select(
        'id, channel_id, type, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name)',
      )
      .in('channel_id', channelIds)
      .is('deleted_at', null)
      .is('thread_parent_id', null)
      .order('created_at', { ascending: false })
      .limit(channelIds.length * 3);
    if (error) throw new InternalServerErrorException(error.message);
    if (!msgRows?.length) return new Map();

    const latestByChannel = new Map<string, Record<string, unknown>>();
    for (const row of msgRows as Record<string, unknown>[]) {
      const channelId = row.channel_id as string;
      if (!latestByChannel.has(channelId)) latestByChannel.set(channelId, row);
    }

    const textMessageIds = Array.from(latestByChannel.values())
      .filter((row) => row.type === 'text')
      .map((row) => row.id as string);

    const textByMessageId = new Map<string, string>();
    if (textMessageIds.length) {
      const { data: textRows, error: textError } = await supabase
        .from('message_text')
        .select('message_id, payload')
        .in('message_id', textMessageIds);
      if (textError) throw new InternalServerErrorException(textError.message);

      for (const row of (textRows ?? []) as Array<{
        message_id: string;
        payload: Record<string, unknown>;
      }>) {
        const text = (row.payload?.text as string | undefined)?.trim();
        if (text) textByMessageId.set(row.message_id, text);
      }
    }

    const result = new Map<string, LastMessageInfo>();
    for (const [channelId, row] of latestByChannel) {
      const sender = row.sender as {
        display_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      } | null;
      result.set(channelId, {
        text:
          row.type === 'text'
            ? (textByMessageId.get(row.id as string) ?? null)
            : (PREVIEW_LABELS[(row.type as string) ?? ''] ?? null),
        at: (row.created_at as string) ?? null,
        sender: sender
          ? sender.display_name?.trim() ||
            [sender.first_name, sender.last_name].filter(Boolean).join(' ') ||
            null
          : null,
      });
    }

    return result;
  }

  listChannelsForUser(_userId: string) {
    return this.prisma.channel.findMany({
      where: {
        // relies on RLS in Supabase if used directly there; here it's simple prisma query
      },
    });
  }

  async getDirectMessages(
    accessToken: string,
    input: { orgId: string; profileId: string; accountId: string },
  ): Promise<ChannelListItem[]> {
    if (!input.orgId || !input.profileId || !input.accountId) return [];
    const supabase = createSupabaseSessionClient(accessToken);

    const { data: myMemberships, error: myError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('profile_id', input.profileId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null);
    if (myError) throw new InternalServerErrorException(myError.message);
    if (!myMemberships?.length) return [];

    const userChannelIds = myMemberships.map(
      (membership) => membership.channel_id as string,
    );
    const { data: chRows, error: chError } = await supabase
      .from('channels')
      .select('id, org_id, topic, description, kind, updated_at')
      .in('id', userChannelIds)
      .eq('org_id', input.orgId)
      .eq('kind', 'dm')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (chError) throw new InternalServerErrorException(chError.message);
    if (!chRows?.length) return [];

    const channelIds = chRows.map((channel) => channel.id);
    const [
      { data: memberRows, error: memberError },
      { data: readStateRows, error: readStateError },
      { data: threadReadStateRows, error: threadReadStateError },
      lastMessages,
    ] = await Promise.all([
      supabase
        .from('channel_members')
        .select(
          'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, city, country_code, country_name, kind)',
        )
        .in('channel_id', channelIds)
        .is('deleted_at', null),
      supabase
        .from('channel_read_state')
        .select('channel_id, unread_count')
        .eq('account_id', input.accountId)
        .in('channel_id', channelIds)
        .is('thread_id', null)
        .is('deleted_at', null),
      supabase
        .from('channel_read_state')
        .select('channel_id, unread_count')
        .eq('account_id', input.accountId)
        .in('channel_id', channelIds)
        .not('thread_id', 'is', null)
        .is('deleted_at', null),
      this.fetchLastMessages(accessToken, channelIds),
    ]);
    if (memberError) throw new InternalServerErrorException(memberError.message);
    if (readStateError) throw new InternalServerErrorException(readStateError.message);
    if (threadReadStateError)
      throw new InternalServerErrorException(threadReadStateError.message);

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
    const participantMap = new Map<string, DmParticipant[]>();
    for (const member of memberRows ?? []) {
      const profile = member.profile as unknown as DmParticipant | null;
      if (!profile || member.profile_id === input.profileId) continue;
      const list = participantMap.get(member.channel_id as string) ?? [];
      list.push(profile);
      participantMap.set(member.channel_id as string, list);
    }

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
        thread_unread_count: Math.max(0, threadUnreadByChannelId.get(channel.id) ?? 0),
        last_message_text: last?.text ?? null,
        last_message_at: last?.at ?? null,
        last_message_sender: last?.sender ?? null,
        participants: participantMap.get(channel.id) ?? [],
      };
    });
  }

  async getSupervisedDirectMessages(
    accessToken: string,
    input: { orgId: string; guardianAccountId: string; guardianProfileId: string },
  ): Promise<ChannelListItem[]> {
    if (!input.orgId || !input.guardianAccountId || !input.guardianProfileId) return [];
    const supabase = createSupabaseSessionClient(accessToken);

    const { data: links, error: linksError } = await supabase
      .from('family_links')
      .select('child_account_id')
      .eq('guardian_account_id', input.guardianAccountId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null);
    if (linksError) throw new InternalServerErrorException(linksError.message);
    if (!links?.length) return [];

    const childAccountIds = links
      .map((link) => link.child_account_id as string)
      .filter(Boolean);
    const { data: childProfiles, error: childProfilesError } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name, account_id')
      .in('account_id', childAccountIds)
      .is('deleted_at', null);
    if (childProfilesError)
      throw new InternalServerErrorException(childProfilesError.message);
    if (!childProfiles?.length) return [];

    const { data: guardianMemberships, error: gmError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('profile_id', input.guardianProfileId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null);
    if (gmError) throw new InternalServerErrorException(gmError.message);
    const guardianChannelIds = new Set(
      (guardianMemberships ?? []).map((membership) => membership.channel_id as string),
    );

    const results: ChannelListItem[] = [];
    for (const child of childProfiles as Array<Record<string, unknown>>) {
      const childName =
        (child.display_name as string | null)?.trim() ||
        [child.first_name, child.last_name].filter(Boolean).join(' ').trim() ||
        'Child';

      const { data: childMemberships, error: cmError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('profile_id', child.id as string)
        .eq('org_id', input.orgId)
        .is('deleted_at', null);
      if (cmError) throw new InternalServerErrorException(cmError.message);

      const childOnlyChannelIds = (childMemberships ?? [])
        .map((membership) => membership.channel_id as string)
        .filter((id) => !guardianChannelIds.has(id));
      if (!childOnlyChannelIds.length) continue;

      const { data: chRows, error: channelsError } = await supabase
        .from('channels')
        .select('id, org_id, topic, description, kind, updated_at')
        .in('id', childOnlyChannelIds)
        .eq('org_id', input.orgId)
        .eq('kind', 'dm')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (channelsError) throw new InternalServerErrorException(channelsError.message);
      if (!chRows?.length) continue;

      const channelIds = chRows.map((channel) => channel.id);
      const [
        { data: readStateRows, error: readError },
        { data: threadReadStateRows, error: threadReadError },
        { data: memberRows, error: memberError },
      ] = await Promise.all([
        supabase
          .from('channel_read_state')
          .select('channel_id, unread_count')
          .eq('account_id', child.account_id as string)
          .in('channel_id', channelIds)
          .is('thread_id', null)
          .is('deleted_at', null),
        supabase
          .from('channel_read_state')
          .select('channel_id, unread_count')
          .eq('account_id', child.account_id as string)
          .in('channel_id', channelIds)
          .not('thread_id', 'is', null)
          .is('deleted_at', null),
        supabase
          .from('channel_members')
          .select(
            'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, city, country_code, country_name, kind)',
          )
          .in('channel_id', channelIds)
          .is('deleted_at', null),
      ]);
      if (readError) throw new InternalServerErrorException(readError.message);
      if (threadReadError)
        throw new InternalServerErrorException(threadReadError.message);
      if (memberError) throw new InternalServerErrorException(memberError.message);

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
      const participantsMap = new Map<string, DmParticipant[]>();
      for (const member of memberRows ?? []) {
        const profile = Array.isArray(member.profile)
          ? ((member.profile[0] as DmParticipant | undefined) ?? null)
          : (member.profile as DmParticipant | null);
        if (!profile || member.profile_id === child.id) continue;
        const list = participantsMap.get(member.channel_id as string) ?? [];
        list.push(profile);
        participantsMap.set(member.channel_id as string, list);
      }

      for (const channel of chRows) {
        results.push({
          id: channel.id,
          org_id: channel.org_id,
          topic: channel.topic ?? null,
          description: channel.description ?? null,
          kind: channel.kind,
          updated_at: channel.updated_at,
          unread_count: Math.max(0, readStateByChannelId.get(channel.id) ?? 0),
          thread_unread_count: Math.max(0, threadUnreadByChannelId.get(channel.id) ?? 0),
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

  async findDirectMessageChannel(
    accessToken: string,
    input: { orgId: string; profileId: string; otherProfileId: string },
  ) {
    if (
      !input.orgId ||
      !input.profileId ||
      !input.otherProfileId ||
      input.profileId === input.otherProfileId
    ) {
      return null;
    }
    const supabase = createSupabaseSessionClient(accessToken);
    const [
      { data: currentMemberships, error: currentError },
      { data: targetMemberships, error: targetError },
    ] = await Promise.all([
      supabase
        .from('channel_members')
        .select('channel_id')
        .eq('org_id', input.orgId)
        .eq('profile_id', input.profileId)
        .is('deleted_at', null),
      supabase
        .from('channel_members')
        .select('channel_id')
        .eq('org_id', input.orgId)
        .eq('profile_id', input.otherProfileId)
        .is('deleted_at', null),
    ]);
    if (currentError) throw new InternalServerErrorException(currentError.message);
    if (targetError) throw new InternalServerErrorException(targetError.message);

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
        .eq('org_id', input.orgId)
        .eq('kind', 'dm')
        .eq('status', 'active')
        .in('id', sharedChannelIds)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1),
      supabase
        .from('profiles')
        .select(
          'id, display_name, first_name, last_name, avatar_url, avatar_seed, timezone, city, country_code, country_name, kind',
        )
        .eq('id', input.otherProfileId)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);
    if (channelsError) throw new InternalServerErrorException(channelsError.message);
    if (profileError) throw new InternalServerErrorException(profileError.message);

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
      avatarCity: (targetProfile.city as string | null) ?? null,
      avatarCountryCode: (targetProfile.country_code as string | null) ?? null,
      avatarCountryName: (targetProfile.country_name as string | null) ?? null,
    };
  }

  async getChannels(
    accessToken: string,
    input: { orgId: string; accountId: string },
  ): Promise<ChannelListItem[]> {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('channels')
      .select(
        `
        id, org_id, topic, description, kind, updated_at,
        channel_read_state!left(unread_count)
      `,
      )
      .eq('org_id', input.orgId)
      .eq('kind', 'channel')
      .eq('status', 'active')
      .is('deleted_at', null)
      .eq('channel_read_state.account_id', input.accountId)
      .is('channel_read_state.thread_id', null)
      .order('updated_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    if (!data?.length) return [];

    const lastMessages = await this.fetchLastMessages(
      accessToken,
      data.map((channel) => channel.id),
    );

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
        thread_unread_count: 0,
        last_message_text: last?.text ?? null,
        last_message_at: last?.at ?? null,
        last_message_sender: last?.sender ?? null,
      };
    });
  }

  async getMembership(
    accessToken: string,
    input: { orgId: string; channelId: string; profileId: string },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return { isMember: Boolean(data) };
  }

  async getReadState(
    accessToken: string,
    input: { channelId: string; accountId: string; threadId?: string | null },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    let query = supabase
      .from('channel_read_state')
      .select('channel_id, thread_id, last_read_message_id, last_read_at, unread_count')
      .eq('channel_id', input.channelId)
      .eq('account_id', input.accountId)
      .is('deleted_at', null);
    query = input.threadId
      ? query.eq('thread_id', input.threadId)
      : query.is('thread_id', null);

    const { data, error } = await query.maybeSingle<{
      channel_id: string;
      thread_id: string | null;
      last_read_message_id: string | null;
      last_read_at: string | null;
      unread_count: number | null;
    }>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) return null;
    return {
      channelId: data.channel_id,
      threadId: data.thread_id ?? null,
      lastReadMessageId: data.last_read_message_id ?? null,
      lastReadAt: data.last_read_at ?? null,
      unreadCount: data.unread_count ?? 0,
    };
  }

  async markReadState(
    accessToken: string,
    input: {
      orgId: string;
      accountId: string;
      profileId: string;
      channelId: string;
      threadId?: string | null;
      lastReadMessageId?: string | null;
    },
  ) {
    if (input.threadId) {
      return this.threadsService.markRead(accessToken, {
        ...input,
        threadId: input.threadId,
      });
    }

    return this.markRead(accessToken, {
      ...input,
      lastReadMessageId: input.lastReadMessageId ?? undefined,
    });
  }

  async markRead(
    accessToken: string,
    input: {
      orgId: string;
      accountId: string;
      profileId: string;
      channelId: string;
      lastReadMessageId?: string;
    },
  ) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();

    // Step 1: Try session-level membership check (works for direct profile owners).
    const membershipLookup = await sessionSupabase
      .from('channel_members')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (membershipLookup.error) {
      throw new InternalServerErrorException(membershipLookup.error.message);
    }

    // Step 2: If session can't see the membership (guardian acting as child via RLS),
    // verify authorization via family_links using the service client.
    if (!membershipLookup.data) {
      const { data: authUser, error: authError } = await sessionSupabase.auth.getUser();
      if (authError || !authUser?.user?.id) {
        return { unreadCount: 0 };
      }
      const authUserId = authUser.user.id;

      const { data: guardianAccount, error: guardianErr } = await serviceSupabase
        .from('accounts')
        .select('id')
        .eq('auth_user_id', authUserId)
        .eq('org_id', input.orgId)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();
      if (guardianErr) throw new InternalServerErrorException(guardianErr.message);
      if (!guardianAccount) return { unreadCount: 0 };

      const { data: childProfile, error: profileErr } = await serviceSupabase
        .from('profiles')
        .select('account_id')
        .eq('id', input.profileId)
        .eq('org_id', input.orgId)
        .is('deleted_at', null)
        .maybeSingle<{ account_id: string }>();
      if (profileErr) throw new InternalServerErrorException(profileErr.message);
      if (!childProfile) return { unreadCount: 0 };

      const { data: familyLink, error: familyLinkErr } = await serviceSupabase
        .from('family_links')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('guardian_account_id', guardianAccount.id)
        .eq('child_account_id', childProfile.account_id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();
      if (familyLinkErr) throw new InternalServerErrorException(familyLinkErr.message);
      if (!familyLink) return { unreadCount: 0 };

      // Confirm child is actually a member of the channel via service client.
      const { data: serviceMembership, error: svcMemberErr } = await serviceSupabase
        .from('channel_members')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('profile_id', input.profileId)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();
      if (svcMemberErr) throw new InternalServerErrorException(svcMemberErr.message);
      if (!serviceMembership) return { unreadCount: 0 };
    }

    // Use service client for message lookups — guardian's session is RLS-blocked from child's messages.
    let resolvedMessageId = input.lastReadMessageId;
    if (resolvedMessageId) {
      const messageLookup = await serviceSupabase
        .from('messages')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('id', resolvedMessageId)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();
      if (messageLookup.error) {
        throw new InternalServerErrorException(messageLookup.error.message);
      }
    } else {
      const latestLookup = await serviceSupabase
        .from('messages')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (latestLookup.error) {
        throw new InternalServerErrorException(latestLookup.error.message);
      }
      resolvedMessageId = latestLookup.data?.id;
    }

    if (!resolvedMessageId) return { unreadCount: 0 };

    const { data, error } = await serviceSupabase.rpc(
      'recompute_unread_for_account_channel',
      {
        p_org_id: input.orgId,
        p_channel_id: input.channelId,
        p_account_id: input.accountId,
        p_last_read_message_id: resolvedMessageId,
        p_last_read_at: new Date().toISOString(),
        p_actor_profile_id: input.profileId,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { unreadCount: typeof data === 'number' ? data : 0 };
  }
}
