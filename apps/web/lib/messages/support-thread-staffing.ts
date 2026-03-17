import type { SupabaseClient } from '@supabase/supabase-js';

type SupportAssignmentKind = 'required' | 'optional';

export async function listActiveSupportStaffProfileIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string[]> {
  const [staffProfilesResponse, staffRoleAccountsResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, account_id')
      .eq('org_id', orgId)
      .eq('kind', 'staff')
      .is('deleted_at', null)
      .returns<Array<{ id: string; account_id: string }>>(),
    supabase
      .from('user_roles')
      .select('account_id')
      .eq('org_id', orgId)
      .eq('role_key', 'staff')
      .is('deleted_at', null)
      .returns<Array<{ account_id: string }>>(),
  ]);

  if (staffProfilesResponse.error) {
    throw new Error(staffProfilesResponse.error.message);
  }
  if (staffRoleAccountsResponse.error) {
    throw new Error(staffRoleAccountsResponse.error.message);
  }

  const staffAccountIds = Array.from(
    new Set((staffRoleAccountsResponse.data ?? []).map((row) => row.account_id)),
  );

  const roleStaffProfilesResponse = staffAccountIds.length
    ? await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .in('account_id', staffAccountIds)
        .is('deleted_at', null)
        .returns<Array<{ id: string }>>()
    : { data: [] as Array<{ id: string }> };

  if ('error' in roleStaffProfilesResponse && roleStaffProfilesResponse.error) {
    throw new Error(roleStaffProfilesResponse.error.message);
  }

  return Array.from(
    new Set([
      ...(staffProfilesResponse.data ?? []).map((row) => row.id),
      ...(roleStaffProfilesResponse.data ?? []).map((row) => row.id),
    ]),
  );
}

async function upsertSupportThreadAssignments(input: {
  supabase: SupabaseClient;
  orgId: string;
  threadId: string;
  staffProfileIds: string[];
  assignmentKind: SupportAssignmentKind;
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

export async function seedRequiredSupportThreadAssignments(input: {
  supabase: SupabaseClient;
  orgId: string;
  threadId: string;
  assignedByProfileId: string;
  now: string;
}) {
  const staffProfileIds = await listActiveSupportStaffProfileIds(
    input.supabase,
    input.orgId,
  );

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

export async function markSupportStaffVolunteerAssignment(input: {
  supabase: SupabaseClient;
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
