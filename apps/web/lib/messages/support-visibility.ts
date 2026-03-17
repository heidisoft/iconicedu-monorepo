import type { SupabaseClient } from '@supabase/supabase-js';

export type SupportVisibilityFields = {
  visibility_type: 'all' | 'specific-users';
  visibility_user_ids?: string[];
};

type ResolveSupportQuestionOwnerInput = {
  supabase: SupabaseClient;
  orgId: string;
  channelId: string;
  threadParentId?: string | null;
  threadId?: string | null;
  parentSenderProfileId?: string | null;
};

export async function isStaffActorInOrg(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    accountId: string;
    profileKind?: string | null;
  },
): Promise<boolean> {
  if (input.profileKind === 'staff') {
    return true;
  }

  const rolesTable = supabase.from('user_roles') as unknown as {
    select?: (columns: string) => {
      eq: (column: string, value: string) => unknown;
    };
  };

  if (typeof rolesTable.select !== 'function') {
    return false;
  }

  const roleResponse = await supabase
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

export async function listSupportPrivilegedProfileIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string[]> {
  const [
    staffProfilesResponse,
    privilegedRoleAccountsResponse,
    privilegedPrimaryRoleAccountsResponse,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('kind', 'staff')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>(),
    supabase
      .from('user_roles')
      .select('account_id')
      .eq('org_id', orgId)
      .in('role_key', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .returns<Array<{ account_id: string }>>(),
    supabase
      .from('accounts')
      .select('id')
      .eq('org_id', orgId)
      .in('primary_role', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>(),
  ]);

  if (staffProfilesResponse.error) {
    throw new Error(staffProfilesResponse.error.message);
  }
  if (privilegedRoleAccountsResponse.error) {
    throw new Error(privilegedRoleAccountsResponse.error.message);
  }
  if (privilegedPrimaryRoleAccountsResponse.error) {
    throw new Error(privilegedPrimaryRoleAccountsResponse.error.message);
  }

  const privilegedAccountIds = Array.from(
    new Set([
      ...(privilegedRoleAccountsResponse.data ?? []).map((row) => row.account_id),
      ...(privilegedPrimaryRoleAccountsResponse.data ?? []).map((row) => row.id),
    ]),
  );

  const privilegedProfilesByRoleResponse = privilegedAccountIds.length
    ? await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .in('account_id', privilegedAccountIds)
        .is('deleted_at', null)
        .returns<Array<{ id: string }>>()
    : { data: [] as Array<{ id: string }> };

  if (
    'error' in privilegedProfilesByRoleResponse &&
    privilegedProfilesByRoleResponse.error
  ) {
    throw new Error(privilegedProfilesByRoleResponse.error.message);
  }

  return Array.from(
    new Set([
      ...(staffProfilesResponse.data ?? []).map((row) => row.id),
      ...(privilegedProfilesByRoleResponse.data ?? []).map((row) => row.id),
    ]),
  );
}

export async function resolveSupportQuestionOwnerProfileId(
  input: ResolveSupportQuestionOwnerInput,
): Promise<string | null> {
  if (input.parentSenderProfileId) {
    return input.parentSenderProfileId;
  }

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

export function buildSupportVisibilityFields(input: {
  isSupportChannel: boolean;
  isStaffSender: boolean;
  isThreadReply: boolean;
  currentProfileId: string;
  questionOwnerProfileId?: string | null;
  privilegedProfileIds?: string[];
}): SupportVisibilityFields {
  if (!input.isSupportChannel) {
    return { visibility_type: 'all' };
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
      visibility_type: 'specific-users',
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
    visibility_type: 'specific-users',
    visibility_user_ids: Array.from(
      new Set([ownerId, ...(input.privilegedProfileIds ?? [])]),
    ),
  };
}
