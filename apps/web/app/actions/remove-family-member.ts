'use server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';

type RemoveFamilyMemberInput = {
  childAccountId: string;
};

export async function removeFamilyMemberAction(
  input: RemoveFamilyMemberInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);
  const guardianAccount = actor.account;
  const now = new Date().toISOString();
  const serviceClient = getFamilyInviteAdminClient();

  const accountResult = await getAccountById(serviceClient, input.childAccountId);
  const childAccount = accountResult.data;
  const shouldHardDeleteAccount = childAccount
    ? !childAccount.email_verified && !childAccount.auth_user_id
    : false;

  const linkMatch = {
    org_id: guardianAccount.org_id,
    guardian_account_id: guardianAccount.id,
    child_account_id: input.childAccountId,
  };

  if (shouldHardDeleteAccount) {
    const { error: deleteLinkError } = await serviceClient
      .from('family_links')
      .delete()
      .match(linkMatch)
      .is('deleted_at', null);

    if (deleteLinkError) {
      throw deleteLinkError;
    }

    const { error: deleteAccountError } = await serviceClient
      .from('accounts')
      .delete()
      .eq('id', input.childAccountId);

    if (deleteAccountError) {
      throw deleteAccountError;
    }

    return;
  }

  const { error } = await serviceClient
    .from('family_links')
    .update({
      deleted_at: now,
      deleted_by: guardianAccount.id,
    })
    .match(linkMatch)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}
