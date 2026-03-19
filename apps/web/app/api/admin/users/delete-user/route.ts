import { NextResponse } from 'next/server';

import { deleteUserAction } from '@iconicedu/web/lib/auth/admin-actions';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';

type DeleteRequestBody = {
  accountId?: string;
};

export async function POST(request: Request) {
  const { accountId } = (await request.json()) as DeleteRequestBody;

  if (!accountId) {
    return NextResponse.json(
      { success: false, message: 'accountId is required' },
      { status: 400 },
    );
  }

  const adminClient = getFamilyInviteAdminClient();
  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .select('id, org_id, auth_user_id')
    .eq('id', accountId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json(
      { success: false, message: accountError.message },
      { status: 500 },
    );
  }

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const authContext = await requireAdminOrgContext(account.org_id, { allowStaff: true });
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  if (account.auth_user_id) {
    const result = await deleteUserAction({
      userId: account.auth_user_id,
      softDelete: false,
    });
    return NextResponse.json(result);
  }

  try {
    await deleteAccountOnly(adminClient, account.id, account.org_id);
    return NextResponse.json({
      action: 'delete-account',
      success: true,
      message: 'Account records removed.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Cleanup failed.',
      },
      { status: 500 },
    );
  }
}

async function deleteAccountOnly(
  adminClient: ReturnType<typeof getFamilyInviteAdminClient>,
  accountId: string,
  orgId: string,
) {
  const accountDeletion = adminClient
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('org_id', orgId);

  const profileDeletion = adminClient
    .from('profiles')
    .delete()
    .eq('account_id', accountId)
    .eq('org_id', orgId);

  const familyLinkDeletion = adminClient
    .from('family_links')
    .delete()
    .eq('org_id', orgId)
    .or(`guardian_account_id.eq.${accountId},child_account_id.eq.${accountId}`);

  await Promise.all([profileDeletion, familyLinkDeletion, accountDeletion]);
}
