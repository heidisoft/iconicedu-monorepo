import type { SupabaseClient } from '@supabase/supabase-js';

type ThreadRow = {
  id: string;
  parent_message_id: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string | null;
  thread_parent_id: string | null;
  sender_profile_id: string;
};

type ProfileRow = {
  id: string;
  account_id: string;
  kind?: string | null;
};

type RoleRow = {
  account_id: string;
};

export type SupportThreadReplyCoverage = {
  threadId: string;
  questionOwnerProfileId: string | null;
  staffProfileIds: string[];
  requiredStaffProfileIds: string[];
  repliedStaffProfileIds: string[];
  pendingRequiredStaffProfileIds: string[];
  volunteerStaffProfileIds: string[];
};

type SupportThreadAssignmentRow = {
  thread_id: string;
  staff_profile_id: string;
  assignment_kind: 'required' | 'optional';
};

export type SupportThreadStaffCoverageVM = SupportThreadReplyCoverage;

export async function listSupportThreadReplyCoverage(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    channelId: string;
  },
): Promise<SupportThreadReplyCoverage[]> {
  const [threadsResponse, staffProfilesResponse, staffRolesResponse] = await Promise.all([
    supabase
      .from('threads')
      .select('id, parent_message_id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .returns<ThreadRow[]>(),
    supabase
      .from('profiles')
      .select('id, account_id, kind')
      .eq('org_id', input.orgId)
      .eq('kind', 'staff')
      .is('deleted_at', null)
      .returns<ProfileRow[]>(),
    supabase
      .from('user_roles')
      .select('account_id')
      .eq('org_id', input.orgId)
      .eq('role_key', 'staff')
      .is('deleted_at', null)
      .returns<RoleRow[]>(),
  ]);

  if (threadsResponse.error) {
    throw new Error(threadsResponse.error.message);
  }
  if (staffProfilesResponse.error) {
    throw new Error(staffProfilesResponse.error.message);
  }
  if (staffRolesResponse.error) {
    throw new Error(staffRolesResponse.error.message);
  }

  const threads = threadsResponse.data ?? [];
  if (!threads.length) {
    return [];
  }

  const threadIds = threads.map((row) => row.id);
  const parentMessageIds = threads
    .map((row) => row.parent_message_id)
    .filter((value): value is string => Boolean(value));

  const [threadMessagesResponse, parentMessagesResponse] = await Promise.all([
    supabase
      .from('messages')
      .select('id, thread_id, thread_parent_id, sender_profile_id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .in('thread_id', threadIds)
      .is('deleted_at', null)
      .returns<MessageRow[]>(),
    parentMessageIds.length
      ? supabase
          .from('messages')
          .select('id, sender_profile_id')
          .eq('org_id', input.orgId)
          .in('id', parentMessageIds)
          .is('deleted_at', null)
          .returns<Array<{ id: string; sender_profile_id: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; sender_profile_id: string }> }),
  ]);

  if (threadMessagesResponse.error) {
    throw new Error(threadMessagesResponse.error.message);
  }
  if (parentMessagesResponse.error) {
    throw new Error(parentMessagesResponse.error.message);
  }

  const assignmentResponse = await supabase
    .from('support_thread_assignments')
    .select('thread_id, staff_profile_id, assignment_kind')
    .eq('org_id', input.orgId)
    .in('thread_id', threadIds)
    .is('deleted_at', null)
    .returns<SupportThreadAssignmentRow[]>();

  if (assignmentResponse.error) {
    throw new Error(assignmentResponse.error.message);
  }

  const roleAccountIds = new Set(
    (staffRolesResponse.data ?? []).map((row) => row.account_id),
  );
  const allProfilesResponse = roleAccountIds.size
    ? await supabase
        .from('profiles')
        .select('id, account_id')
        .eq('org_id', input.orgId)
        .in('account_id', Array.from(roleAccountIds))
        .is('deleted_at', null)
        .returns<Array<{ id: string; account_id: string }>>()
    : { data: [] as Array<{ id: string; account_id: string }> };

  if ('error' in allProfilesResponse && allProfilesResponse.error) {
    throw new Error(allProfilesResponse.error.message);
  }

  const staffProfileIds = Array.from(
    new Set([
      ...(staffProfilesResponse.data ?? []).map((row) => row.id),
      ...(allProfilesResponse.data ?? []).map((row) => row.id),
    ]),
  );
  const staffProfileIdSet = new Set(staffProfileIds);

  const parentSenderByMessageId = new Map(
    (parentMessagesResponse.data ?? []).map((row) => [row.id, row.sender_profile_id]),
  );
  const requiredAssignmentsByThread = new Map<string, Set<string>>();
  const optionalAssignmentsByThread = new Map<string, Set<string>>();

  for (const assignment of assignmentResponse.data ?? []) {
    const targetMap =
      assignment.assignment_kind === 'required'
        ? requiredAssignmentsByThread
        : optionalAssignmentsByThread;
    const bucket = targetMap.get(assignment.thread_id) ?? new Set<string>();
    bucket.add(assignment.staff_profile_id);
    targetMap.set(assignment.thread_id, bucket);
  }

  const repliesByThread = new Map<string, Set<string>>();
  for (const message of threadMessagesResponse.data ?? []) {
    if (!message.thread_id || !message.thread_parent_id) {
      continue;
    }
    if (!staffProfileIdSet.has(message.sender_profile_id)) {
      continue;
    }
    const existing = repliesByThread.get(message.thread_id) ?? new Set<string>();
    existing.add(message.sender_profile_id);
    repliesByThread.set(message.thread_id, existing);
  }

  return threads.map((thread) => {
    const questionOwnerProfileId = thread.parent_message_id
      ? (parentSenderByMessageId.get(thread.parent_message_id) ?? null)
      : null;
    const repliedStaffProfileIds = Array.from(repliesByThread.get(thread.id) ?? []);
    const repliedSet = new Set(repliedStaffProfileIds);
    const requiredAssignments = requiredAssignmentsByThread.get(thread.id);
    const requiredStaffProfileIds =
      requiredAssignments && requiredAssignments.size
        ? Array.from(requiredAssignments)
        : staffProfileIds;
    const requiredSet = new Set(requiredStaffProfileIds);
    const volunteerStaffProfileIds = repliedStaffProfileIds.filter(
      (profileId) => !requiredSet.has(profileId),
    );

    const pendingRequiredStaffProfileIds = requiredStaffProfileIds.filter(
      (profileId) => !repliedSet.has(profileId),
    );

    return {
      threadId: thread.id,
      questionOwnerProfileId,
      staffProfileIds,
      requiredStaffProfileIds,
      repliedStaffProfileIds,
      pendingRequiredStaffProfileIds,
      volunteerStaffProfileIds: Array.from(
        new Set([
          ...volunteerStaffProfileIds,
          ...Array.from(optionalAssignmentsByThread.get(thread.id) ?? []).filter(
            (profileId) => repliedSet.has(profileId) && !requiredSet.has(profileId),
          ),
        ]),
      ),
    };
  });
}
