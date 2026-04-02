'use server';

import type {
  AccountRow,
  FamilyLinkInviteRole,
  FamilyLinkInviteVM,
  FamilyRelation,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import {
  acceptFamilyInvite,
  createFamilyInvite,
  deleteFamilyInvite,
  getFamilyInviteAdminClient,
  mapFamilyLinkInviteRowToVM,
} from '@iconicedu/web/lib/family/queries/invite.query';
import { reportWebObservedError } from '@iconicedu/web/lib/analytics/report-error';

type ResolvedGuardianContext = {
  supabase: SupabaseClient;
  accountId: string;
  orgId: string;
};

async function resolveGuardianContext(): Promise<ResolvedGuardianContext> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);

  return {
    supabase,
    accountId: actor.account.id,
    orgId: actor.account.org_id,
  };
}

async function resolveAccountContext(): Promise<{
  supabase: SupabaseClient;
  account: AccountRow;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);

  return {
    supabase,
    account: actor.account,
  };
}

export async function sendFamilyInviteAction(input: {
  invitedRole: FamilyLinkInviteRole;
  invitedEmail: string;
  invitedPhoneE164?: string | null;
  targetAccountId?: string;
}): Promise<FamilyLinkInviteVM> {
  const { supabase, accountId, orgId } = await resolveGuardianContext();
  const insertedInvite = await createFamilyInvite({
    supabase,
    guardianAccountId: accountId,
    orgId,
    invitedRole: input.invitedRole,
    invitedEmail: input.invitedEmail,
    invitedPhoneE164: input.invitedPhoneE164 ?? null,
    targetAccountId: input.targetAccountId,
    createdByAccountId: accountId,
  });
  return mapFamilyLinkInviteRowToVM(insertedInvite);
}

export async function revokeFamilyInviteAction(input: { inviteId: string }) {
  const { supabase, accountId, orgId } = await resolveGuardianContext();
  const { data: inviteRow, error: inviteError } = await supabase
    .from('family_link_invites')
    .select('invited_email, status')
    .eq('id', input.inviteId)
    .eq('created_by_account_id', accountId)
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle();

  if (inviteError) {
    throw inviteError;
  }

  if (!inviteRow) {
    throw new Error('Invite not found.');
  }

  await deleteFamilyInvite({
    supabase,
    inviteId: input.inviteId,
    guardianAccountId: accountId,
    orgId,
  });

  if (inviteRow.status === 'pending' && inviteRow.invited_email) {
    try {
      const adminClient = getFamilyInviteAdminClient();
      const { data: accountRow } = await adminClient
        .from('accounts')
        .select('auth_user_id')
        .eq('org_id', orgId)
        .eq('email', inviteRow.invited_email)
        .limit(1)
        .maybeSingle();

      if (accountRow?.auth_user_id) {
        await adminClient.auth.admin.deleteUser(accountRow.auth_user_id);
      }
    } catch (error) {
      reportWebObservedError({
        error,
        source: 'web.actions.family_invite.cleanup_invited_user',
        message: 'Failed to clean up invited user after invite removal',
        context: {
          inviteId: input.inviteId,
          orgId,
          invitedEmail: inviteRow.invited_email,
        },
      });
    }
  }
}

export async function acceptFamilyInviteAction(input: {
  inviteId: string;
  relation?: FamilyRelation;
  permissionsScope?: string[] | null;
}): Promise<FamilyLinkInviteVM> {
  const { account } = await resolveAccountContext();
  return acceptFamilyInvite({
    inviteId: input.inviteId,
    account,
    relation: input.relation,
    permissionsScope: input.permissionsScope,
  });
}
