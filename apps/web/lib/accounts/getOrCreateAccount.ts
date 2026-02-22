import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountRow, FamilyLinkInviteRow } from '@iconicedu/shared-types';

import {
  getAccountByAuthUserId,
  getAccountByEmail,
  insertAccountForAuthUser,
  updateAccountAuthUserId,
  getAccountById,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { findFamilyInviteForAccount } from '@iconicedu/web/lib/family/queries/invite.query';

export async function getOrCreateAccount(
  supabase: SupabaseClient,
  input: { orgId: string; authUserId: string; authEmail?: string | null },
): Promise<{ account: AccountRow; invite: FamilyLinkInviteRow | null }> {
  const { data: account } = await getAccountByAuthUserId(
    supabase,
    input.authUserId,
  );

  const normalizedEmail = input.authEmail?.trim().toLowerCase();

  if (account) {
    const invite = await findFamilyInviteForAccount({
      supabase,
      orgId: input.orgId,
      accountId: account.id,
      email: normalizedEmail,
    });
    return { account, invite };
  }

  if (normalizedEmail) {
    const { data: invitedAccount, error: invitedAccountError } = await getAccountByEmail(
      supabase,
      input.orgId,
      normalizedEmail,
    );
    if (invitedAccountError) {
      throw invitedAccountError;
    }
    if (invitedAccount?.id) {
      const { data: updatedAccount, error: updateError } = await updateAccountAuthUserId(
        supabase,
        invitedAccount.id,
        input.authUserId,
      );
      if (updateError) {
        throw updateError;
      }
      if (updatedAccount) {
        const invite = await findFamilyInviteForAccount({
          supabase,
          orgId: input.orgId,
          accountId: updatedAccount.id,
          email: normalizedEmail,
        });
        return { account: updatedAccount, invite };
      }

      const refreshed = await getAccountById(supabase, invitedAccount.id);
      if (refreshed.data) {
        const invite = await findFamilyInviteForAccount({
          supabase,
          orgId: input.orgId,
          accountId: refreshed.data.id,
          email: normalizedEmail,
        });
        return { account: refreshed.data, invite };
      }

    }
  }

  const { data: inserted, error } = await insertAccountForAuthUser(supabase, {
    orgId: input.orgId,
    authUserId: input.authUserId,
    email: input.authEmail ?? null,
  });

  if (error || !inserted) {
    redirect('/iconic-academy/login');
  }

  const invite = await findFamilyInviteForAccount({
    supabase,
    orgId: input.orgId,
    accountId: inserted.id,
    email: normalizedEmail,
  });

  return { account: inserted, invite };
}
