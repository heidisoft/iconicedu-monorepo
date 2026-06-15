import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AudienceRuleVM,
  FeedScopeVM,
  MessageVM,
  MessageMentionVM,
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  ReactionVM,
  ThreadVM,
} from '@iconicedu/shared-types';
import {
  resolveActivityChannelContext,
  resolveVisibilityAudienceFromMessageRow,
} from '@iconicedu/api/lib/messages/message-activity';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  filterVisibleMessageRows,
  mapRowToMessageVM,
  type RawMessageRow,
  type RawSenderProfile,
  buildSenderProfile,
} from '@iconicedu/api/lib/mobile-data/message-mappers';

const BASE_MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, visibility_type, visibility_user_ids, type, created_at, updated_at, thread_parent_id,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, timezone, ui_theme_key)
`;

const TYPE_TABLE: Record<string, string> = {
  text: 'message_text',
  image: 'message_image',
  file: 'message_file',
  'audio-recording': 'message_audio_recording',
  'link-preview': 'message_link_preview',
  'lesson-assignment': 'message_lesson_assignment',
  'homework-submission': 'message_homework_submission',
  'progress-update': 'message_progress_update',
  'event-reminder': 'message_event_reminder',
  'session-summary': 'message_session_summary',
  'session-complete': 'message_session_complete',
  'session-booking': 'message_session_booking',
  'payment-reminder': 'message_payment_reminder',
  'feedback-request': 'message_feedback_request',
};

type RawThreadRow = {
  id: string;
  org_id: string;
  channel_id: string;
  parent_message_id: string;
  snippet: string | null;
  author_id: string | null;
  author_name: string | null;
  message_count: number | null;
  last_reply_at: string | null;
  created_at: string;
};

type RawThreadParticipantRow = {
  thread_id: string;
  profile: RawSenderProfile | null;
};

type RawReadStateByThreadRow = {
  thread_id: string;
  channel_id: string | null;
  last_read_message_id: string | null;
  last_read_at: string | null;
  unread_count: number | null;
};

type WritableProfileRow = {
  id: string;
  org_id: string;
  account_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  kind: string | null;
};

type ActivityChannelContext = Awaited<ReturnType<typeof resolveActivityChannelContext>>;

type HomeworkMessageIntent = {
  kind: 'homework' | 'lesson';
  cleanedContent: string;
  description: string;
  title: string;
  dueAt: string;
  subject: string;
};

function buildWritableProfileDisplayName(profile: WritableProfileRow) {
  const displayName = profile.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [profile.first_name?.trim(), profile.last_name?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  return fullName || 'Someone';
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaContent(html: string, property: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return undefined;
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ? decodeHtml(titleMatch[1].trim()) : undefined;
}

function resolveRelativeUrl(baseUrl: string, candidate?: string) {
  if (!candidate) return undefined;

  try {
    return new globalThis.URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractFirstUrl(text: string) {
  return text.match(URL_PATTERN)?.[1] ?? null;
}

function isSafeLinkPreviewUrl(url: string): boolean {
  try {
    const parsed = new globalThis.URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    return !PRIVATE_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchLinkPreviewMetadata(url: string) {
  if (!isSafeLinkPreviewUrl(url)) {
    throw new Error('Unsafe URL for link preview');
  }

  const normalizedUrl = new globalThis.URL(url).toString();
  const fallbackHost = new globalThis.URL(normalizedUrl).hostname.replace(/^www\./, '');

  try {
    const response = await fetch(normalizedUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'ICONICEDULinkPreviewBot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch link preview: ${response.status}`);
    }

    const html = await response.text();
    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDescription = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');
    const ogSiteName = extractMetaContent(html, 'og:site_name');
    const metaDescription = extractMetaContent(html, 'description');
    const title = ogTitle ?? extractTitle(html) ?? fallbackHost;
    const faviconHref =
      html.match(
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      )?.[1] ?? '/favicon.ico';

    return {
      url: normalizedUrl,
      title,
      description: ogDescription ?? metaDescription,
      imageUrl: resolveRelativeUrl(normalizedUrl, ogImage),
      siteName: ogSiteName ?? fallbackHost,
      favicon: resolveRelativeUrl(normalizedUrl, faviconHref),
    };
  } catch {
    return {
      url: normalizedUrl,
      title: fallbackHost,
      siteName: fallbackHost,
      favicon: resolveRelativeUrl(normalizedUrl, '/favicon.ico'),
    };
  }
}

function sanitizeMentions(
  content: string,
  mentions: MessageMentionVM[] | undefined,
  allowedProfileIds: Set<string>,
  currentProfileId: string,
): MessageMentionVM[] {
  if (!mentions?.length) {
    return [];
  }

  const seen = new Set<string>();

  return mentions.filter((mention) => {
    if (!mention?.profileId || mention.profileId === currentProfileId) {
      return false;
    }
    if (!allowedProfileIds.has(mention.profileId)) {
      return false;
    }
    if (
      typeof mention.displayName !== 'string' ||
      typeof mention.start !== 'number' ||
      typeof mention.end !== 'number'
    ) {
      return false;
    }
    if (
      mention.start < 0 ||
      mention.end <= mention.start ||
      mention.end > content.length
    ) {
      return false;
    }
    if (content.slice(mention.start, mention.end) !== `@${mention.displayName}`) {
      return false;
    }

    const key = `${mention.profileId}:${mention.start}:${mention.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deriveHomeworkMessageIntent(
  content: string,
  activityContext: ActivityChannelContext,
  explicitHomework?: MessageSendTextInput['homework'],
): HomeworkMessageIntent | null {
  if (!explicitHomework) {
    return null;
  }

  return {
    kind: explicitHomework.kind === 'lesson' ? 'lesson' : 'homework',
    cleanedContent: content.trim(),
    description:
      explicitHomework.description?.trim() ||
      content.trim() ||
      'Open the class to review the new assignment.',
    title: explicitHomework.title.trim() || 'Homework assignment',
    dueAt: explicitHomework.dueAt,
    subject:
      explicitHomework.subject?.trim() ||
      activityContext.learningSpaceTitle ||
      activityContext.channelTopic ||
      'Homework',
  };
}

function isValidMessageAssetPath(input: {
  storagePath: string;
  orgId: string;
  channelId: string;
  profileId: string;
}) {
  const segments = input.storagePath.split('/');
  if (segments.length < 5) {
    return false;
  }

  const [orgId, channelId, assetKind, profileId] = segments;
  const allowedAssetKinds = new Set(['files', 'images', 'audio']);

  return (
    orgId === input.orgId &&
    channelId === input.channelId &&
    allowedAssetKinds.has(assetKind) &&
    profileId === input.profileId
  );
}

async function isStaffActorInOrg(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  accountId: string;
  profileKind?: string | null;
}): Promise<boolean> {
  if (input.profileKind === 'staff') {
    return true;
  }

  const roleResponse = await input.supabase
    .from('user_roles')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('account_id', input.accountId)
    .eq('role_key', 'staff')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (roleResponse.error) {
    throw new Error(roleResponse.error.message);
  }

  return Boolean(roleResponse.data?.id);
}

async function listSupportStaffProfileIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  orgId: string,
  options?: { includeAdmins?: boolean },
): Promise<string[]> {
  const includeAdmins = options?.includeAdmins ?? false;
  const roleKeys = includeAdmins ? ['owner', 'admin', 'staff'] : ['staff'];

  const staffProfilesQuery = supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('kind', 'staff')
    .is('deleted_at', null)
    .returns<Array<{ id: string }>>();

  const roleAccountsQuery = supabase
    .from('user_roles')
    .select('account_id')
    .eq('org_id', orgId)
    .in('role_key', roleKeys)
    .is('deleted_at', null)
    .returns<Array<{ account_id: string }>>();

  const primaryRoleAccountsQuery = includeAdmins
    ? supabase
        .from('accounts')
        .select('id')
        .eq('org_id', orgId)
        .in('primary_role', roleKeys)
        .is('deleted_at', null)
        .returns<Array<{ id: string }>>()
    : Promise.resolve({ data: [] as Array<{ id: string }>, error: null });

  const [staffProfilesResponse, roleAccountsResponse, primaryRoleAccountsResponse] =
    await Promise.all([staffProfilesQuery, roleAccountsQuery, primaryRoleAccountsQuery]);

  if (staffProfilesResponse.error) {
    throw new Error(staffProfilesResponse.error.message);
  }
  if (roleAccountsResponse.error) {
    throw new Error(roleAccountsResponse.error.message);
  }
  if (primaryRoleAccountsResponse.error) {
    throw new Error(primaryRoleAccountsResponse.error.message);
  }

  const roleAccountIds = Array.from(
    new Set([
      ...(roleAccountsResponse.data ?? []).map((row) => row.account_id),
      ...(primaryRoleAccountsResponse.data ?? []).map((row) => row.id),
    ]),
  );

  const profilesByRoleResponse = roleAccountIds.length
    ? await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .in('account_id', roleAccountIds)
        .is('deleted_at', null)
        .returns<Array<{ id: string }>>()
    : { data: [] as Array<{ id: string }>, error: null };

  if ('error' in profilesByRoleResponse && profilesByRoleResponse.error) {
    throw new Error(profilesByRoleResponse.error.message);
  }

  return Array.from(
    new Set([
      ...(staffProfilesResponse.data ?? []).map((row) => row.id),
      ...(profilesByRoleResponse.data ?? []).map((row) => row.id),
    ]),
  );
}

async function resolveSupportQuestionOwnerProfileId(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  channelId: string;
  threadParentId?: string | null;
  threadId?: string | null;
}): Promise<string | null> {
  if (input.threadParentId) {
    const parentResponse = await input.supabase
      .from('messages')
      .select('id, sender_profile_id, org_id, channel_id')
      .eq('id', input.threadParentId)
      .maybeSingle<{
        id: string;
        sender_profile_id: string;
        org_id: string;
        channel_id: string;
      }>();

    if (parentResponse.error) {
      throw new Error(parentResponse.error.message);
    }

    if (!parentResponse.data) {
      return null;
    }

    if (
      parentResponse.data.org_id !== input.orgId ||
      parentResponse.data.channel_id !== input.channelId
    ) {
      return null;
    }

    return parentResponse.data.sender_profile_id;
  }

  if (!input.threadId) {
    return null;
  }

  const threadResponse = await input.supabase
    .from('threads')
    .select('id, parent_message_id, org_id, channel_id')
    .eq('id', input.threadId)
    .maybeSingle<{
      id: string;
      parent_message_id: string | null;
      org_id: string;
      channel_id: string;
    }>();

  if (threadResponse.error) {
    throw new Error(threadResponse.error.message);
  }
  if (!threadResponse.data?.parent_message_id) {
    return null;
  }
  if (
    threadResponse.data.org_id !== input.orgId ||
    threadResponse.data.channel_id !== input.channelId
  ) {
    return null;
  }

  const parentResponse = await input.supabase
    .from('messages')
    .select('id, sender_profile_id')
    .eq('id', threadResponse.data.parent_message_id)
    .maybeSingle<{ id: string; sender_profile_id: string }>();

  if (parentResponse.error) {
    throw new Error(parentResponse.error.message);
  }

  return parentResponse.data?.sender_profile_id ?? null;
}

function buildSupportVisibilityFields(input: {
  isSupportChannel: boolean;
  isStaffSender: boolean;
  isThreadReply: boolean;
  currentProfileId: string;
  questionOwnerProfileId?: string | null;
  privilegedProfileIds?: string[];
}) {
  if (!input.isSupportChannel) {
    return { visibility_type: 'all' as const };
  }

  if (!input.isThreadReply) {
    if (input.isStaffSender) {
      throw new Error(
        'Support staff must reply in a thread. Top-level support posts are not allowed.',
      );
    }
    const visibleProfileIds = Array.from(
      new Set([input.currentProfileId, ...(input.privilegedProfileIds ?? [])]),
    );
    return {
      visibility_type: 'specific-users' as const,
      visibility_user_ids: visibleProfileIds,
    };
  }

  const ownerId = input.questionOwnerProfileId;
  if (!ownerId) {
    throw new Error('Unable to resolve support question owner for threaded reply.');
  }

  if (!input.isStaffSender && input.currentProfileId !== ownerId) {
    throw new Error('Only support staff or the question owner can reply in this thread.');
  }

  return {
    visibility_type: 'specific-users' as const,
    visibility_user_ids: Array.from(
      new Set([ownerId, ...(input.privilegedProfileIds ?? [])]),
    ),
  };
}

async function ensureChannelMembershipForMessageWrite(input: {
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  shouldEnsureMembership: boolean;
  orgId: string;
  channelId: string;
  profileId: string;
  now: string;
}) {
  if (!input.shouldEnsureMembership) {
    return;
  }

  const upsertResponse = await input.serviceSupabase.from('channel_members').upsert(
    {
      org_id: input.orgId,
      channel_id: input.channelId,
      profile_id: input.profileId,
      joined_at: input.now,
      created_at: input.now,
      created_by: input.profileId,
      updated_at: input.now,
      updated_by: input.profileId,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: 'org_id,channel_id,profile_id', ignoreDuplicates: false },
  );

  if (upsertResponse.error) {
    throw new Error(upsertResponse.error.message);
  }
}

async function hasOperationalMessageWriteRole(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  accountId: string;
  profileKind?: string | null;
}): Promise<boolean> {
  if (input.profileKind === 'staff') {
    return true;
  }

  const [roleResponse, accountResponse] = await Promise.all([
    input.supabase
      .from('user_roles')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('account_id', input.accountId)
      .in('role_key', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>(),
    input.supabase
      .from('accounts')
      .select('id')
      .eq('id', input.accountId)
      .eq('org_id', input.orgId)
      .in('primary_role', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  if (roleResponse.error) {
    throw new Error(roleResponse.error.message);
  }
  if (accountResponse.error) {
    throw new Error(accountResponse.error.message);
  }

  return Boolean(roleResponse.data?.id || accountResponse.data?.id);
}

export async function resolveChannelWriteAccessForMessage(input: {
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  activityContext: ActivityChannelContext;
  orgId: string;
  channelId: string;
  accountId: string;
  profileId: string;
  profileKind?: string | null;
}): Promise<{ shouldEnsureMembership: boolean }> {
  const membershipResponse = await input.serviceSupabase
    .from('channel_members')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message);
  }

  const isChannelMember = Boolean(membershipResponse.data?.id);
  const isSupportChannel = input.activityContext.channelPurpose === 'support';
  const isPublicChannel = input.activityContext.channelVisibility === 'public';

  if (isChannelMember) {
    return {
      shouldEnsureMembership: isSupportChannel || isPublicChannel,
    };
  }

  if (isSupportChannel) {
    return { shouldEnsureMembership: true };
  }

  const hasOperationalRole = await hasOperationalMessageWriteRole({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    accountId: input.accountId,
    profileKind: input.profileKind,
  });
  const isClassroomChannel =
    input.activityContext.channelRouteKind === 'space' ||
    input.activityContext.channelPurpose === 'learning-space';

  if (hasOperationalRole && isClassroomChannel) {
    return { shouldEnsureMembership: false };
  }

  if (isPublicChannel) {
    return { shouldEnsureMembership: true };
  }

  throw new ForbiddenException('You do not have permission to post in this channel');
}

async function upsertSupportThreadAssignments(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  threadId: string;
  staffProfileIds: string[];
  assignmentKind: 'required' | 'optional';
  assignedByProfileId: string;
  now: string;
}) {
  if (!input.staffProfileIds.length) {
    return;
  }

  const rows = input.staffProfileIds.map((staffProfileId) => ({
    org_id: input.orgId,
    thread_id: input.threadId,
    staff_profile_id: staffProfileId,
    assignment_kind: input.assignmentKind,
    assigned_by_profile_id: input.assignedByProfileId,
    created_at: input.now,
    created_by: input.assignedByProfileId,
    updated_at: input.now,
    updated_by: input.assignedByProfileId,
    deleted_at: null,
    deleted_by: null,
  }));

  const upsertResponse = await input.supabase
    .from('support_thread_assignments')
    .upsert(rows, {
      onConflict: 'org_id,thread_id,staff_profile_id',
      ignoreDuplicates: true,
    });

  if (upsertResponse.error) {
    throw new Error(upsertResponse.error.message);
  }
}

async function seedRequiredSupportThreadAssignments(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  threadId: string;
  assignedByProfileId: string;
  now: string;
}) {
  const staffProfileIds = await listSupportStaffProfileIds(input.supabase, input.orgId);

  await upsertSupportThreadAssignments({
    supabase: input.supabase,
    orgId: input.orgId,
    threadId: input.threadId,
    staffProfileIds,
    assignmentKind: 'required',
    assignedByProfileId: input.assignedByProfileId,
    now: input.now,
  });
}

async function markSupportStaffVolunteerAssignment(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  threadId: string;
  staffProfileId: string;
  assignedByProfileId: string;
  now: string;
}) {
  await upsertSupportThreadAssignments({
    supabase: input.supabase,
    orgId: input.orgId,
    threadId: input.threadId,
    staffProfileIds: [input.staffProfileId],
    assignmentKind: 'optional',
    assignedByProfileId: input.assignedByProfileId,
    now: input.now,
  });
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  private async loadPayloads(
    accessToken: string,
    rows: Array<{ id: string; type: string }>,
  ): Promise<Map<string, Record<string, unknown>>> {
    const supabase = createSupabaseSessionClient(accessToken);
    const byType = new Map<string, string[]>();
    for (const row of rows) {
      const bucket = byType.get(row.type) ?? [];
      bucket.push(row.id);
      byType.set(row.type, bucket);
    }

    const payloadMap = new Map<string, Record<string, unknown>>();
    await Promise.all(
      Array.from(byType.entries()).map(async ([type, ids]) => {
        const table = TYPE_TABLE[type];
        if (!table) return;
        const { data, error } = await supabase
          .from(table)
          .select('message_id, payload')
          .in('message_id', ids)
          .is('deleted_at', null);
        if (error) throw error;
        for (const row of (data ?? []) as Array<{
          message_id: string;
          payload: Record<string, unknown>;
        }>) {
          payloadMap.set(row.message_id, row.payload);
        }
      }),
    );

    return payloadMap;
  }

  private async loadReactions(
    accessToken: string,
    messageIds: string[],
    currentAccountId: string,
  ): Promise<Map<string, ReactionVM[]>> {
    if (!messageIds.length) return new Map();
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, account_id')
      .in('message_id', messageIds)
      .is('deleted_at', null);
    if (error) throw error;

    const grouped = new Map<string, Array<{ emoji: string; account_id: string }>>();
    for (const row of (data ?? []) as Array<{
      message_id: string;
      emoji: string;
      account_id: string;
    }>) {
      const bucket = grouped.get(row.message_id) ?? [];
      bucket.push({ emoji: row.emoji, account_id: row.account_id });
      grouped.set(row.message_id, bucket);
    }

    const result = new Map<string, ReactionVM[]>();
    for (const [messageId, rawReactions] of grouped) {
      const byEmoji = new Map<string, string[]>();
      for (const reaction of rawReactions) {
        const accounts = byEmoji.get(reaction.emoji) ?? [];
        accounts.push(reaction.account_id);
        byEmoji.set(reaction.emoji, accounts);
      }
      result.set(
        messageId,
        Array.from(byEmoji.entries()).map(([emoji, accountIds]) => ({
          emoji,
          count: accountIds.length,
          reactedByMe: currentAccountId ? accountIds.includes(currentAccountId) : false,
          sampleUserIds: accountIds.slice(0, 5),
        })),
      );
    }

    return result;
  }

  private async loadThreads(
    accessToken: string,
    parentMessageIds: string[],
    currentAccountId?: string,
  ): Promise<Map<string, ThreadVM>> {
    if (!parentMessageIds.length) return new Map();
    const supabase = createSupabaseSessionClient(accessToken);

    const { data: threadRows, error: threadError } = await supabase
      .from('threads')
      .select(
        'id, org_id, channel_id, parent_message_id, snippet, author_id, author_name, message_count, last_reply_at, created_at',
      )
      .in('parent_message_id', parentMessageIds);
    if (threadError || !threadRows?.length) {
      return new Map();
    }

    const typedThreadRows = threadRows as RawThreadRow[];
    const threadIds = typedThreadRows.map((thread) => thread.id);
    const [
      { data: participantRows, error: participantError },
      { data: readStateRows, error: readStateError },
    ] = await Promise.all([
      supabase
        .from('thread_participants')
        .select(
          'thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, timezone, ui_theme_key)',
        )
        .in('thread_id', threadIds)
        .is('deleted_at', null),
      currentAccountId
        ? supabase
            .from('channel_read_state')
            .select(
              'thread_id, channel_id, last_read_message_id, last_read_at, unread_count',
            )
            .eq('account_id', currentAccountId)
            .in('thread_id', threadIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] as RawReadStateByThreadRow[], error: null }),
    ]);
    if (participantError) throw participantError;
    if (readStateError) throw readStateError;

    const participantsByThread = new Map<string, RawSenderProfile[]>();
    for (const participant of (participantRows ??
      []) as unknown as RawThreadParticipantRow[]) {
      if (!participant.profile) continue;
      const list = participantsByThread.get(participant.thread_id) ?? [];
      list.push(participant.profile);
      participantsByThread.set(participant.thread_id, list);
    }

    const readStateByThread = new Map(
      ((readStateRows ?? []) as RawReadStateByThreadRow[]).map((row) => [
        row.thread_id,
        {
          threadId: row.thread_id,
          channelId: row.channel_id ?? undefined,
          lastReadMessageId: row.last_read_message_id ?? undefined,
          lastReadAt: row.last_read_at ?? undefined,
          unreadCount: row.unread_count ?? undefined,
        },
      ]),
    );

    const result = new Map<string, ThreadVM>();
    for (const thread of typedThreadRows) {
      result.set(thread.parent_message_id, {
        ids: { id: thread.id, orgId: thread.org_id },
        parent: {
          messageId: thread.parent_message_id,
          snippet: thread.snippet ?? undefined,
          authorId: thread.author_id ?? undefined,
          authorName: thread.author_name ?? undefined,
        },
        stats: {
          messageCount: thread.message_count ?? 0,
          lastReplyAt: thread.last_reply_at ?? thread.created_at,
        },
        participants: (participantsByThread.get(thread.id) ?? []).map((profile) =>
          buildSenderProfile(profile, thread.org_id),
        ),
        readState:
          readStateByThread.get(thread.id) ??
          ({
            threadId: thread.id,
            channelId: thread.channel_id,
          } as ThreadVM['readState']),
      });
    }

    return result;
  }

  private async resolveWritableProfile(input: {
    authUserId: string;
    accessToken: string;
    orgId: string;
    senderProfileId: string;
  }) {
    const supabase = createSupabaseServiceClient();

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', input.authUserId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; org_id: string }>();
    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) throw new ForbiddenException('Account not found');

    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind',
      )
      .eq('id', input.senderProfileId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle<WritableProfileRow>();
    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!senderProfile) throw new NotFoundException('Profile not found');

    if (senderProfile.account_id === account.id) {
      return { accountId: account.id, profile: senderProfile };
    }

    const { data: familyLink, error: familyLinkError } = await supabase
      .from('family_links')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('guardian_account_id', account.id)
      .eq('child_account_id', senderProfile.account_id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (familyLinkError) throw new InternalServerErrorException(familyLinkError.message);
    if (!familyLink) {
      throw new ForbiddenException('Sender profile is not available to this account');
    }

    return { accountId: account.id, profile: senderProfile };
  }

  private async resolveThreadContext(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    currentProfile: WritableProfileRow;
    requestedThreadId?: string | null;
    threadParentId?: string | null;
    now: string;
  }): Promise<{ threadId: string | null; threadCreated: boolean }> {
    const sessionSupabase = createSupabaseSessionClient(input.accessToken);
    const serviceSupabase = createSupabaseServiceClient();
    let threadId: string | null = null;
    let threadCreated = false;

    if (!input.threadParentId) {
      return { threadId: input.requestedThreadId ?? null, threadCreated };
    }

    const parentResponse = await sessionSupabase
      .from('messages')
      .select('id, org_id, channel_id, sender_profile_id, thread_id, type')
      .eq('id', input.threadParentId)
      .maybeSingle<{
        id: string;
        org_id: string;
        channel_id: string;
        sender_profile_id: string;
        thread_id?: string | null;
        type: string;
      }>();
    if (parentResponse.error) {
      throw new InternalServerErrorException(parentResponse.error.message);
    }
    const parentMessage = parentResponse.data;
    if (
      !parentMessage ||
      parentMessage.org_id !== input.orgId ||
      parentMessage.channel_id !== input.channelId
    ) {
      throw new NotFoundException('Parent message not found');
    }

    if (parentMessage.thread_id) {
      threadId = parentMessage.thread_id;
    }

    if (!threadId && input.requestedThreadId) {
      const requestedThreadResponse = await serviceSupabase
        .from('threads')
        .select('id, org_id, channel_id, parent_message_id')
        .eq('id', input.requestedThreadId)
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('parent_message_id', parentMessage.id)
        .is('deleted_at', null)
        .maybeSingle<{
          id: string;
          org_id: string;
          channel_id: string;
          parent_message_id: string;
        }>();
      if (requestedThreadResponse.error) {
        throw new InternalServerErrorException(requestedThreadResponse.error.message);
      }
      threadId = requestedThreadResponse.data?.id ?? null;
    }

    if (!threadId) {
      const parentPayloadResponse = await sessionSupabase
        .from('message_text')
        .select('payload')
        .eq('message_id', parentMessage.id)
        .maybeSingle<{ payload: Record<string, unknown> | null }>();
      if (parentPayloadResponse.error) {
        throw new InternalServerErrorException(parentPayloadResponse.error.message);
      }
      const parentProfileResponse = await sessionSupabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', parentMessage.sender_profile_id)
        .is('deleted_at', null)
        .maybeSingle<{
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>();
      if (parentProfileResponse.error) {
        throw new InternalServerErrorException(parentProfileResponse.error.message);
      }

      const snippet =
        typeof parentPayloadResponse.data?.payload?.text === 'string'
          ? parentPayloadResponse.data.payload.text
          : parentMessage.type;
      const authorName =
        parentProfileResponse.data?.display_name?.trim() ||
        [parentProfileResponse.data?.first_name, parentProfileResponse.data?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        null;

      const threadInsert = await serviceSupabase
        .from('threads')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          parent_message_id: parentMessage.id,
          snippet: snippet?.slice(0, 140) ?? null,
          author_id: parentMessage.sender_profile_id,
          author_name: authorName,
          message_count: 1,
          last_reply_at: input.now,
          created_at: input.now,
          created_by: input.currentProfile.id,
          updated_at: input.now,
          updated_by: input.currentProfile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (threadInsert.error || !threadInsert.data) {
        throw new InternalServerErrorException(
          threadInsert.error?.message ?? 'Unable to create thread',
        );
      }

      threadId = threadInsert.data.id;
      threadCreated = true;

      const updateParent = await serviceSupabase
        .from('messages')
        .update({
          thread_id: threadId,
          updated_at: input.now,
          updated_by: input.currentProfile.id,
        })
        .eq('id', parentMessage.id);
      if (updateParent.error) {
        throw new InternalServerErrorException(updateParent.error.message);
      }
    }

    if (threadId) {
      const participantRows = Array.from(
        new Set([parentMessage.sender_profile_id, input.currentProfile.id]),
      ).map((profileId) => ({
        org_id: input.orgId,
        thread_id: threadId as string,
        profile_id: profileId,
        created_at: input.now,
        created_by: input.currentProfile.id,
        updated_at: input.now,
        updated_by: input.currentProfile.id,
      }));

      const participantInsert = await serviceSupabase
        .from('thread_participants')
        .upsert(participantRows, { onConflict: 'org_id,thread_id,profile_id' });
      if (participantInsert.error) {
        throw new InternalServerErrorException(participantInsert.error.message);
      }
    }

    return { threadId, threadCreated };
  }

  private async bumpThreadReplyCount(input: {
    accessToken: string;
    threadId: string | null;
    threadCreated: boolean;
    now: string;
    currentProfileId: string;
  }) {
    if (!input.threadId || input.threadCreated) {
      return;
    }

    const serviceSupabase = createSupabaseServiceClient();
    const threadRow = await serviceSupabase
      .from('threads')
      .select('id, message_count')
      .eq('id', input.threadId)
      .maybeSingle<{ id: string; message_count: number | null }>();
    if (threadRow.error) {
      throw new InternalServerErrorException(threadRow.error.message);
    }
    if (!threadRow.data) {
      return;
    }

    const updateThread = await serviceSupabase
      .from('threads')
      .update({
        message_count: (threadRow.data.message_count ?? 0) + 1,
        last_reply_at: input.now,
        updated_at: input.now,
        updated_by: input.currentProfileId,
      })
      .eq('id', input.threadId);
    if (updateThread.error) {
      throw new InternalServerErrorException(updateThread.error.message);
    }
  }

  async getChannelMessages(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    profileId: string;
    accountId: string;
    limit?: number;
    before?: string;
  }): Promise<MessageVM[]> {
    const supabase = createSupabaseSessionClient(input.accessToken);
    let query = supabase
      .from('messages')
      .select(BASE_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .is('thread_parent_id', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 40);

    if (input.before) {
      query = query.lt('created_at', input.before);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const typedRows = filterVisibleMessageRows(
      (data ?? []) as unknown as RawMessageRow[],
      input.profileId,
    );
    if (!typedRows.length) return [];

    const messageIds = typedRows.map((row) => row.id);
    const [payloadMap, reactionMap, threadsMap] = await Promise.all([
      this.loadPayloads(input.accessToken, typedRows),
      this.loadReactions(input.accessToken, messageIds, input.accountId),
      this.loadThreads(input.accessToken, messageIds, input.accountId),
    ]);

    return [...typedRows]
      .reverse()
      .map((row) =>
        mapRowToMessageVM(
          row,
          payloadMap.get(row.id) ?? null,
          reactionMap.get(row.id) ?? [],
          threadsMap.get(row.id),
        ),
      );
  }

  async getThreadMessages(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    threadId: string;
    parentMessageId: string;
    profileId: string;
    accountId: string;
  }): Promise<MessageVM[]> {
    const supabase = createSupabaseSessionClient(input.accessToken);
    let { data: rows, error } = await supabase
      .from('messages')
      .select(BASE_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .eq('thread_id', input.threadId)
      .neq('id', input.parentMessageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!error && (!rows || rows.length === 0)) {
      ({ data: rows, error } = await supabase
        .from('messages')
        .select(BASE_MESSAGE_SELECT)
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('thread_parent_id', input.parentMessageId)
        .neq('id', input.parentMessageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }));
    }

    if (error) throw new InternalServerErrorException(error.message);
    const typedRows = filterVisibleMessageRows(
      (rows ?? []) as unknown as RawMessageRow[],
      input.profileId,
    );
    if (!typedRows.length) return [];

    const messageIds = typedRows.map((row) => row.id);
    const [payloadMap, reactionMap] = await Promise.all([
      this.loadPayloads(input.accessToken, typedRows),
      this.loadReactions(input.accessToken, messageIds, input.accountId),
    ]);

    return typedRows.map((row) =>
      mapRowToMessageVM(
        row,
        payloadMap.get(row.id) ?? null,
        reactionMap.get(row.id) ?? [],
      ),
    );
  }

  async sendTextMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendTextInput,
  ) {
    try {
      const content = input.content.trim();
      if (!content) throw new BadRequestException('Message text is required');

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      let sanitizedMentions: MessageMentionVM[] = [];
      if (input.mentions?.length) {
        const channelMembersResponse = await serviceSupabase
          .from('channel_members')
          .select('profile_id')
          .eq('org_id', input.orgId)
          .eq('channel_id', input.channelId)
          .is('deleted_at', null)
          .returns<Array<{ profile_id: string }>>();

        if (channelMembersResponse.error) {
          throw new InternalServerErrorException(channelMembersResponse.error.message);
        }

        sanitizedMentions = sanitizeMentions(
          content,
          input.mentions,
          new Set((channelMembersResponse.data ?? []).map((member) => member.profile_id)),
          actor.profile.id,
        );
      }

      const now = new Date().toISOString();
      const activityContext = await resolveActivityChannelContext({
        supabase: serviceSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
      });
      const homeworkIntent = deriveHomeworkMessageIntent(
        content,
        activityContext,
        input.homework ?? null,
      );
      const firstUrl = homeworkIntent ? null : extractFirstUrl(content);
      const previewMetadata = firstUrl ? await fetchLinkPreviewMetadata(firstUrl) : null;
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });

      const isSupportChannel = activityContext.channelPurpose === 'support';
      const isSupportThreadReply = Boolean(input.threadParentId);
      const staffSender = await isStaffActorInOrg({
        supabase: serviceSupabase,
        orgId: input.orgId,
        accountId: actor.accountId,
        profileKind: actor.profile.kind,
      });
      const supportQuestionOwnerProfileId =
        isSupportChannel && isSupportThreadReply
          ? await resolveSupportQuestionOwnerProfileId({
              supabase: serviceSupabase,
              orgId: input.orgId,
              channelId: input.channelId,
              threadParentId: input.threadParentId ?? null,
              threadId: threadId ?? input.threadId ?? null,
            })
          : null;
      const supportPrivilegedProfileIds = isSupportChannel
        ? await listSupportStaffProfileIds(serviceSupabase, input.orgId, {
            includeAdmins: true,
          })
        : [];
      const supportVisibility = buildSupportVisibilityFields({
        isSupportChannel,
        isStaffSender: staffSender,
        isThreadReply: isSupportThreadReply,
        currentProfileId: actor.profile.id,
        questionOwnerProfileId: supportQuestionOwnerProfileId,
        privilegedProfileIds: supportPrivilegedProfileIds,
      });
      const writeAccess = await resolveChannelWriteAccessForMessage({
        serviceSupabase,
        activityContext,
        orgId: input.orgId,
        channelId: input.channelId,
        accountId: actor.accountId,
        profileId: actor.profile.id,
        profileKind: actor.profile.kind,
      });
      await ensureChannelMembershipForMessageWrite({
        serviceSupabase,
        shouldEnsureMembership: writeAccess.shouldEnsureMembership,
        orgId: input.orgId,
        channelId: input.channelId,
        profileId: actor.profile.id,
        now,
      });

      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: homeworkIntent
            ? 'lesson-assignment'
            : previewMetadata
              ? 'link-preview'
              : 'text',
          visibility_type: supportVisibility.visibility_type,
          visibility_user_ids: supportVisibility.visibility_user_ids ?? null,
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const visibilityAudience = resolveVisibilityAudienceFromMessageRow({
        visibilityType:
          (messageInsert.data as { visibility_type?: string | null }).visibility_type ??
          null,
        visibilityUserIds:
          (messageInsert.data as { visibility_user_ids?: string[] | null })
            .visibility_user_ids ?? null,
      });

      const payloadInsert = await serviceSupabase
        .from(
          homeworkIntent
            ? 'message_lesson_assignment'
            : previewMetadata
              ? 'message_link_preview'
              : 'message_text',
        )
        .insert({
          message_id: messageInsert.data.id,
          org_id: input.orgId,
          payload: homeworkIntent
            ? {
                kind: homeworkIntent.kind,
                text: homeworkIntent.cleanedContent,
                title: homeworkIntent.title,
                description: homeworkIntent.description,
                dueAt: homeworkIntent.dueAt,
                subject: homeworkIntent.subject,
              }
            : previewMetadata
              ? {
                  ...(content ? { text: content } : {}),
                  ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
                  url: previewMetadata.url,
                  title: previewMetadata.title,
                  description: previewMetadata.description,
                  imageUrl: previewMetadata.imageUrl,
                  siteName: previewMetadata.siteName,
                  favicon: previewMetadata.favicon,
                }
              : {
                  text: content,
                  ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
                },
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      if (isSupportChannel && threadCreated && threadId) {
        await seedRequiredSupportThreadAssignments({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      if (isSupportChannel && isSupportThreadReply && staffSender && threadId) {
        await markSupportStaffVolunteerAssignment({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          staffProfileId: actor.profile.id,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendTextMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async sendFileMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFileInput,
  ) {
    try {
      if (!input.name?.trim()) throw new BadRequestException('File name is required');
      if (!input.storagePath?.trim()) {
        throw new BadRequestException('File storage path is required');
      }

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      if (
        !isValidMessageAssetPath({
          storagePath: input.storagePath,
          orgId: input.orgId,
          channelId: input.channelId,
          profileId: actor.profile.id,
        })
      ) {
        throw new BadRequestException('Invalid file storage path');
      }
      const now = new Date().toISOString();
      const activityContext = await resolveActivityChannelContext({
        supabase: serviceSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
      });
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });
      const isSupportChannel = activityContext.channelPurpose === 'support';
      const isSupportThreadReply = Boolean(input.threadParentId);
      const staffSender = await isStaffActorInOrg({
        supabase: serviceSupabase,
        orgId: input.orgId,
        accountId: actor.accountId,
        profileKind: actor.profile.kind,
      });
      const supportQuestionOwnerProfileId =
        isSupportChannel && isSupportThreadReply
          ? await resolveSupportQuestionOwnerProfileId({
              supabase: serviceSupabase,
              orgId: input.orgId,
              channelId: input.channelId,
              threadParentId: input.threadParentId ?? null,
              threadId: threadId ?? input.threadId ?? null,
            })
          : null;
      const supportPrivilegedProfileIds = isSupportChannel
        ? await listSupportStaffProfileIds(serviceSupabase, input.orgId, {
            includeAdmins: true,
          })
        : [];
      const supportVisibility = buildSupportVisibilityFields({
        isSupportChannel,
        isStaffSender: staffSender,
        isThreadReply: isSupportThreadReply,
        currentProfileId: actor.profile.id,
        questionOwnerProfileId: supportQuestionOwnerProfileId,
        privilegedProfileIds: supportPrivilegedProfileIds,
      });
      const writeAccess = await resolveChannelWriteAccessForMessage({
        serviceSupabase,
        activityContext,
        orgId: input.orgId,
        channelId: input.channelId,
        accountId: actor.accountId,
        profileId: actor.profile.id,
        profileKind: actor.profile.kind,
      });
      await ensureChannelMembershipForMessageWrite({
        serviceSupabase,
        shouldEnsureMembership: writeAccess.shouldEnsureMembership,
        orgId: input.orgId,
        channelId: input.channelId,
        profileId: actor.profile.id,
        now,
      });

      const isImageUpload = input.mimeType?.startsWith('image/') ?? false;
      const isAudioUpload = input.mimeType?.startsWith('audio/') ?? false;
      const messageType = isImageUpload
        ? 'image'
        : isAudioUpload
          ? 'audio-recording'
          : 'file';

      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: messageType,
          visibility_type: supportVisibility.visibility_type,
          visibility_user_ids: supportVisibility.visibility_user_ids ?? null,
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const payload = {
        url: input.storagePath,
        storagePath: input.storagePath,
        name: input.name,
        size: input.size,
        mimeType: input.mimeType,
        durationSeconds: input.durationSeconds,
        ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
        ...(input.content?.trim() ? { text: input.content.trim() } : {}),
      };
      const payloadTable = isImageUpload
        ? 'message_image'
        : isAudioUpload
          ? 'message_audio_recording'
          : 'message_file';
      const payloadInsert = await serviceSupabase.from(payloadTable).insert({
        message_id: messageInsert.data.id,
        org_id: input.orgId,
        payload,
        created_at: now,
        created_by: actor.profile.id,
        updated_at: now,
        updated_by: actor.profile.id,
      });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      if (isImageUpload) {
        const mediaInsert = await serviceSupabase.from('channel_media').insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: actor.profile.id,
          type: 'image',
          url: input.storagePath,
          name: input.name,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
        if (mediaInsert.error) {
          throw new InternalServerErrorException(mediaInsert.error.message);
        }
      } else if (!isAudioUpload) {
        const fileInsert = await serviceSupabase.from('channel_files').insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: actor.profile.id,
          kind: 'file',
          url: input.storagePath,
          name: input.name,
          mime_type: input.mimeType ?? null,
          size: input.size ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
        if (fileInsert.error) {
          throw new InternalServerErrorException(fileInsert.error.message);
        }
      }

      const visibilityAudience = resolveVisibilityAudienceFromMessageRow({
        visibilityType:
          (messageInsert.data as { visibility_type?: string | null }).visibility_type ??
          null,
        visibilityUserIds:
          (messageInsert.data as { visibility_user_ids?: string[] | null })
            .visibility_user_ids ?? null,
      });

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      if (isSupportChannel && threadCreated && threadId) {
        await seedRequiredSupportThreadAssignments({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      if (isSupportChannel && isSupportThreadReply && staffSender && threadId) {
        await markSupportStaffVolunteerAssignment({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          staffProfileId: actor.profile.id,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendFileMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async sendFilesMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFilesInput,
  ) {
    try {
      if (!input.assets.length) {
        throw new BadRequestException('At least one file is required');
      }

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      for (const asset of input.assets) {
        if (!asset.name?.trim()) {
          throw new BadRequestException('File name is required');
        }
        if (!asset.storagePath?.trim()) {
          throw new BadRequestException('File storage path is required');
        }
        if (
          !isValidMessageAssetPath({
            storagePath: asset.storagePath,
            orgId: input.orgId,
            channelId: input.channelId,
            profileId: actor.profile.id,
          })
        ) {
          throw new BadRequestException('Invalid file storage path');
        }
      }
      const now = new Date().toISOString();
      const activityContext = await resolveActivityChannelContext({
        supabase: serviceSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
      });
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });
      const isSupportChannel = activityContext.channelPurpose === 'support';
      const isSupportThreadReply = Boolean(input.threadParentId);
      const staffSender = await isStaffActorInOrg({
        supabase: serviceSupabase,
        orgId: input.orgId,
        accountId: actor.accountId,
        profileKind: actor.profile.kind,
      });
      const supportQuestionOwnerProfileId =
        isSupportChannel && isSupportThreadReply
          ? await resolveSupportQuestionOwnerProfileId({
              supabase: serviceSupabase,
              orgId: input.orgId,
              channelId: input.channelId,
              threadParentId: input.threadParentId ?? null,
              threadId: threadId ?? input.threadId ?? null,
            })
          : null;
      const supportPrivilegedProfileIds = isSupportChannel
        ? await listSupportStaffProfileIds(serviceSupabase, input.orgId, {
            includeAdmins: true,
          })
        : [];
      const supportVisibility = buildSupportVisibilityFields({
        isSupportChannel,
        isStaffSender: staffSender,
        isThreadReply: isSupportThreadReply,
        currentProfileId: actor.profile.id,
        questionOwnerProfileId: supportQuestionOwnerProfileId,
        privilegedProfileIds: supportPrivilegedProfileIds,
      });
      const writeAccess = await resolveChannelWriteAccessForMessage({
        serviceSupabase,
        activityContext,
        orgId: input.orgId,
        channelId: input.channelId,
        accountId: actor.accountId,
        profileId: actor.profile.id,
        profileKind: actor.profile.kind,
      });
      await ensureChannelMembershipForMessageWrite({
        serviceSupabase,
        shouldEnsureMembership: writeAccess.shouldEnsureMembership,
        orgId: input.orgId,
        channelId: input.channelId,
        profileId: actor.profile.id,
        now,
      });

      const allImages = input.assets.every((asset) =>
        asset.mimeType?.startsWith('image/'),
      );
      const anyImages = input.assets.some((asset) =>
        asset.mimeType?.startsWith('image/'),
      );
      const anyAudio = input.assets.some((asset) => asset.mimeType?.startsWith('audio/'));
      if (anyAudio) {
        throw new BadRequestException('Audio recordings must be sent individually');
      }
      if (anyImages && !allImages) {
        throw new BadRequestException(
          'Mixed file and image uploads must be sent separately',
        );
      }
      const messageType = allImages ? 'image' : 'file';
      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: messageType,
          visibility_type: supportVisibility.visibility_type,
          visibility_user_ids: supportVisibility.visibility_user_ids ?? null,
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const attachments = input.assets.map((asset) => ({
        url: asset.storagePath,
        storagePath: asset.storagePath,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
        ...(asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
      }));
      const payloadInsert = await serviceSupabase
        .from(allImages ? 'message_image' : 'message_file')
        .insert({
          message_id: messageInsert.data.id,
          org_id: input.orgId,
          payload: {
            attachments,
            ...(input.content?.trim() ? { text: input.content.trim() } : {}),
          },
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      const assetTable = allImages ? 'channel_media' : 'channel_files';
      const assetRows = input.assets.map((asset) =>
        allImages
          ? {
              org_id: input.orgId,
              channel_id: input.channelId,
              message_id: messageInsert.data.id,
              sender_profile_id: actor.profile.id,
              type: 'image',
              url: asset.storagePath,
              name: asset.name,
              created_at: now,
              created_by: actor.profile.id,
              updated_at: now,
              updated_by: actor.profile.id,
            }
          : {
              org_id: input.orgId,
              channel_id: input.channelId,
              message_id: messageInsert.data.id,
              sender_profile_id: actor.profile.id,
              kind: 'file',
              url: asset.storagePath,
              name: asset.name,
              mime_type: asset.mimeType ?? null,
              size: asset.size ?? null,
              created_at: now,
              created_by: actor.profile.id,
              updated_at: now,
              updated_by: actor.profile.id,
            },
      );
      const assetInsert = await serviceSupabase.from(assetTable).insert(assetRows);
      if (assetInsert.error) {
        throw new InternalServerErrorException(assetInsert.error.message);
      }

      const visibilityAudience = resolveVisibilityAudienceFromMessageRow({
        visibilityType:
          (messageInsert.data as { visibility_type?: string | null }).visibility_type ??
          null,
        visibilityUserIds:
          (messageInsert.data as { visibility_user_ids?: string[] | null })
            .visibility_user_ids ?? null,
      });

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      if (isSupportChannel && threadCreated && threadId) {
        await seedRequiredSupportThreadAssignments({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      if (isSupportChannel && isSupportThreadReply && staffSender && threadId) {
        await markSupportStaffVolunteerAssignment({
          supabase: serviceSupabase,
          orgId: input.orgId,
          threadId,
          staffProfileId: actor.profile.id,
          assignedByProfileId: actor.profile.id,
          now,
        });
      }

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendFilesMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async deleteMessage(
    accessToken: string,
    messageId: string,
    body: { orgId: string; profileId: string },
  ) {
    if (!body.orgId || !body.profileId) {
      throw new BadRequestException('orgId and profileId are required');
    }

    const serviceSupabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { error } = await serviceSupabase
      .from('messages')
      .update({
        deleted_at: now,
        deleted_by: body.profileId,
        updated_at: now,
        updated_by: body.profileId,
      })
      .eq('org_id', body.orgId)
      .eq('id', messageId);

    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
