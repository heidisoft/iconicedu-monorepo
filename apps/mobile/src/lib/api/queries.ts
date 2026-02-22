import { supabase } from '@/lib/supabase/client';
import type {
  UserProfileBlockVM,
  ChannelVM,
  LearningSpaceVM,
  MessageVM,
} from '@iconicedu/shared-types';
import { mapRowToMessageVM, type RawMessageRow } from './map-row-to-vm';

export const queryKeys = {
  profile: (profileId: string) => ['profile', profileId] as const,
  channels: (orgId: string) => ['channels', orgId] as const,
  directMessages: (orgId: string, profileId: string) =>
    ['directMessages', orgId, profileId] as const,
  channel: (channelId: string) => ['channel', channelId] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  learningSpaces: (orgId: string) => ['learningSpaces', orgId] as const,
  learningSpace: (spaceId: string) => ['learningSpace', spaceId] as const,
  inbox: (orgId: string, profileId: string) =>
    ['inbox', orgId, profileId] as const,
  sidebar: (orgId: string, profileId: string) =>
    ['sidebar', orgId, profileId] as const,
  notificationPrefs: (orgId: string, profileId: string) =>
    ['notificationPrefs', orgId, profileId] as const,
  familyLinks: (orgId: string, accountId: string) =>
    ['familyLinks', orgId, accountId] as const,
  childProfiles: (orgId: string, accountIds: string[]) =>
    ['childProfiles', orgId, accountIds] as const,
} as const;

export async function fetchUserAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error) throw error;
  return account;
}

export async function fetchProfile(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) throw error;
  return data;
}

/** Fetch the profile belonging to a given account (profiles.account_id → accounts.id). */
export async function fetchProfileByAccountId(accountId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export type ChannelListItem = {
  id: string;
  org_id: string;
  topic: string | null;
  description: string | null;
  kind: string;
  updated_at: string;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  /** Learning space subject emoji, e.g. "📐". Populated in demo mode and future API. */
  icon_emoji?: string | null;
  /** Primary student name this space is for, e.g. "Tevin". Populated in demo mode. */
  student_name?: string | null;
};

export async function fetchDirectMessages(
  orgId: string,
  profileId: string,
): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_participants!inner(profile_id),
      channel_read_state(unread_count),
      last_msg:messages(id, content, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name))
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('channel_participants.profile_id', profileId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((ch) => {
    const msgs = (ch.last_msg ?? []) as Array<{
      id: string;
      content: Record<string, unknown> | null;
      created_at: string;
      sender: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
    }>;
    // last_msg comes unsorted – pick the most recent by created_at
    const last = msgs.reduce<typeof msgs[number] | null>((acc, m) =>
      !acc || m.created_at > acc.created_at ? m : acc, null);

    const readState = (ch.channel_read_state as Array<{ unread_count: number | null }> | null)?.[0];

    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic,
      description: ch.description,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last
        ? String(last.content?.text ?? '') || null
        : null,
      last_message_at: last?.created_at ?? null,
      last_message_sender: last?.sender
        ? (last.sender.display_name ??
            ([last.sender.first_name, last.sender.last_name].filter(Boolean).join(' ') || null))
        : null,
    };
  });
}

export async function fetchChannels(orgId: string): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_read_state(unread_count),
      last_msg:messages(id, content, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name))
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'channel')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((ch) => {
    const msgs = (ch.last_msg ?? []) as Array<{
      id: string;
      content: Record<string, unknown> | null;
      created_at: string;
      sender: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
    }>;
    const last = msgs.reduce<typeof msgs[number] | null>((acc, m) =>
      !acc || m.created_at > acc.created_at ? m : acc, null);

    const readState = (ch.channel_read_state as Array<{ unread_count: number | null }> | null)?.[0];

    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic,
      description: ch.description,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last
        ? String(last.content?.text ?? '') || null
        : null,
      last_message_at: last?.created_at ?? null,
      last_message_sender: last?.sender
        ? (last.sender.display_name ??
            ([last.sender.first_name, last.sender.last_name].filter(Boolean).join(' ') || null))
        : null,
    };
  });
}

const MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, type, content, created_at, updated_at, thread_parent_id,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed),
  reactions:message_reactions(emoji, profile_id)
`;

export async function fetchChannelMessages(
  channelId: string,
  currentProfileId = '',
  limit = 40,
  before?: string,
): Promise<MessageVM[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse().map((row) => mapRowToMessageVM(row as RawMessageRow, currentProfileId));
}

export async function fetchThreadMessages(
  threadParentId: string,
  currentProfileId = '',
): Promise<MessageVM[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('thread_parent_id', threadParentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapRowToMessageVM(row as RawMessageRow, currentProfileId));
}

export async function toggleReaction(
  messageId: string,
  profileId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('profile_id', profileId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('profile_id', profileId)
      .eq('emoji', emoji);
  } else {
    await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, profile_id: profileId, emoji });
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function fetchLearningSpaces(orgId: string) {
  const { data, error } = await supabase
    .from('learning_spaces')
    .select(
      `
      *,
      primary_channel:channels!primary_channel_id(*)
    `,
    )
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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
    .select('id, account_id, display_name, first_name, last_name, avatar_seed, kind')
    .eq('org_id', orgId)
    .in('account_id', accountIds)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

const MOBILE_ALLOWED_ROLES = new Set(['educator', 'guardian', 'child', 'staff', 'admin', 'system']);

export type DayAvailability = Record<string, Array<{ start: string; end: string }>>;

export type OnboardingStatus = {
  isComplete: boolean;
  isRoleAllowed: boolean;
  profileId: string | null;
  accountId: string | null;
  orgId: string | null;
  primaryRole: string | null;
  profileKind: string | null;
  flags: {
    hasName: boolean;
    hasTimezone: boolean;
    hasLocation: boolean;
    hasPhone: boolean;
    requiresPhone: boolean;
    hasRoleData: boolean;
    hasAvailability: boolean;
  };
  prefill: {
    firstName: string;
    lastName: string;
    phone: string;
    timezone: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
};

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Account lookup timed out. Please check your connection and try again.')),
      12_000,
    ),
  );
  return Promise.race([_doFetchOnboardingStatus(), timeout]);
}

async function _doFetchOnboardingStatus(): Promise<OnboardingStatus> {
  // getSession() reads from SecureStore — no network request, no hang risk.
  // getUser() verifies with the auth server over the network and can hang indefinitely.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  // Try to find account by auth_user_id first
  const { data: accountByAuthId, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (accountError) {
    console.error('[onboarding] account fetch error:', accountError);
    throw accountError;
  }

  let account = accountByAuthId;

  // Fallback: if account isn't linked yet, try to find it by email and link it.
  // This handles the case where the account was pre-created by an admin but
  // auth_user_id was never set (activate endpoint normally does this on web).
  if (!account && user.email) {
    const { data: accountByEmail } = await supabase
      .from('accounts')
      .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
      .eq('email', user.email.trim().toLowerCase())
      .maybeSingle();

    if (accountByEmail) {
      // Attempt to link this auth user to the account (requires RLS to allow it)
      await supabase
        .from('accounts')
        .update({ auth_user_id: user.id })
        .eq('id', accountByEmail.id);
      account = accountByEmail;
    }
  }

  if (!account) throw new Error('No account found for this user. Please contact your administrator.');

  // Profiles are linked via account_id on the profiles table (not the other way around)
  let profileId: string | null = null;
  let profileKind: string | null = null;
  let firstName = '';
  let lastName = '';
  let timezone = '';
  let city = '';
  let region = '';
  let postalCode = '';
  let countryCode = '';

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, kind, first_name, last_name, timezone, city, region, postal_code, country_code')
    .eq('account_id', account.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileError) console.warn('[onboarding] profile fetch error:', profileError);
  if (profile) {
    profileId   = profile.id;
    profileKind = profile.kind ?? null;
    firstName   = profile.first_name ?? '';
    lastName    = profile.last_name ?? '';
    timezone    = profile.timezone ?? '';
    city        = (profile as Record<string, unknown>).city as string ?? '';
    region      = (profile as Record<string, unknown>).region as string ?? '';
    postalCode  = (profile as Record<string, unknown>).postal_code as string ?? '';
    countryCode = (profile as Record<string, unknown>).country_code as string ?? '';
  }

  const kind = profileKind ?? account.primary_role ?? null;

  // Mirror web's determineOnboardingStep required-field checks:
  const hasName     = !!firstName.trim() && !!lastName.trim();
  const hasTimezone = !!timezone.trim() && timezone.trim() !== 'UTC';
  const hasLocation = !!city.trim() && !!region.trim();
  const requiresPhone = kind !== 'child';
  const hasPhone    = !!(account.phone_e164?.trim());

  // Role-specific checks (child: grade set; educator: subjects + grade levels set)
  let hasRoleData = true;
  if (kind === 'child' && profileId) {
    const { data: gradeRows } = await supabase
      .from('child_profile_grade_level')
      .select('grade_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasRoleData = (gradeRows?.length ?? 0) > 0;
  } else if (kind === 'educator' && profileId) {
    const [{ data: subjectRows }, { data: gradeRows }] = await Promise.all([
      supabase.from('educator_profile_subjects').select('subject').eq('profile_id', profileId).limit(1),
      supabase.from('educator_profile_grade_levels').select('grade_id').eq('profile_id', profileId).limit(1),
    ]);
    hasRoleData = (subjectRows?.length ?? 0) > 0 && (gradeRows?.length ?? 0) > 0;
  }

  // Availability check for educators
  let hasAvailability = kind !== 'educator';
  if (kind === 'educator' && profileId) {
    const { data: availRows } = await supabase
      .from('educator_availabilities')
      .select('profile_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasAvailability = (availRows?.length ?? 0) > 0;
  }

  const isComplete =
    hasName &&
    hasTimezone &&
    hasLocation &&
    (!requiresPhone || hasPhone) &&
    hasRoleData &&
    hasAvailability;

  // All roles are allowed on mobile. Unknown/null roles pass through so the wizard can collect them.
  const isRoleAllowed = kind === null || MOBILE_ALLOWED_ROLES.has(kind);

  return {
    isComplete,
    isRoleAllowed,
    profileId,
    accountId: account.id,
    orgId: account.org_id,
    primaryRole: account.primary_role ?? null,
    profileKind,
    flags: { hasName, hasTimezone, hasLocation, hasPhone, requiresPhone, hasRoleData, hasAvailability },
    prefill: {
      firstName,
      lastName,
      phone: account.phone_e164 ?? '',
      timezone,
      city,
      region,
      postalCode,
      countryCode,
    },
  };
}

// ─── Wizard step saves ─────────────────────────────────────────────────────────

export async function saveNameStep(profileId: string, firstName: string, lastName: string) {
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName.trim(), last_name: lastName.trim(), display_name: displayName })
    .eq('id', profileId);
  if (error) throw error;
}

export async function savePhoneStep(accountId: string, phone: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ phone_e164: phone.trim() || null })
    .eq('id', accountId);
  if (error) throw error;
}

export async function saveTimezoneStep(profileId: string, timezone: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveStudentStep(
  profileId: string,
  orgId: string,
  birthYear: number | null,
  gradeLevel: string | null,
) {
  const { error: profileError } = await supabase
    .from('child_profiles')
    .upsert({ profile_id: profileId, org_id: orgId, birth_year: birthYear }, { onConflict: 'profile_id' });
  if (profileError) throw profileError;

  if (gradeLevel) {
    await supabase.from('child_profile_grade_level').delete().eq('profile_id', profileId);
    const { error: gradeError } = await supabase
      .from('child_profile_grade_level')
      .insert({ profile_id: profileId, org_id: orgId, grade_id: gradeLevel });
    if (gradeError) throw gradeError;
  }
}

export async function saveLocationStep(
  profileId: string,
  city: string,
  region: string,
  postalCode: string,
  countryCode: string,
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      city: city.trim() || null,
      region: region.trim() || null,
      postal_code: postalCode.trim() || null,
      country_code: countryCode || null,
    } as Record<string, unknown>)
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveEducatorProfileStep(
  profileId: string,
  orgId: string,
  subjects: string[],
  gradeLevels: string[],
) {
  // Save subjects
  await supabase.from('educator_profile_subjects').delete().eq('profile_id', profileId);
  if (subjects.length > 0) {
    const subjectRows = subjects.map((subject) => ({ profile_id: profileId, org_id: orgId, subject }));
    const { error } = await supabase.from('educator_profile_subjects').insert(subjectRows);
    if (error) throw error;
  }

  // Save grade levels
  await supabase.from('educator_profile_grade_levels').delete().eq('profile_id', profileId);
  if (gradeLevels.length > 0) {
    const gradeRows = gradeLevels.map((grade_id) => ({ profile_id: profileId, org_id: orgId, grade_id }));
    const { error } = await supabase.from('educator_profile_grade_levels').insert(gradeRows);
    if (error) throw error;
  }
}

export async function saveEducatorAvailabilityStep(
  profileId: string,
  orgId: string,
  classTypes: string[],
  weeklyCommitment: number | null,
  availability: DayAvailability,
) {
  const { error } = await supabase
    .from('educator_availabilities')
    .upsert(
      { profile_id: profileId, org_id: orgId, class_types: classTypes, weekly_commitment: weeklyCommitment, availability },
      { onConflict: 'profile_id' },
    );
  if (error) throw error;
}

export async function completeOnboarding(accountId: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', accountId)
    .is('onboarding_completed_at', null);
  if (error) throw error;
}

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: senderProfileId,
      org_id: orgId,
      type: 'text',
      content: { text },
      thread_parent_id: threadParentId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
