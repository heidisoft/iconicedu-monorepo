import { NextResponse } from 'next/server';

import { inviteAdminUserAction } from '@iconicedu/web/app/(app)/d/admin/users/actions/invite-user';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';

type RowInviteRequest = {
  accountId?: string;
  profileKind?: string;
  mode?: 'invite' | 'link';
  linkType?: 'invite' | 'magiclink';
  redirectTo?: string;
};

export async function POST(request: Request) {
  const { accountId, profileKind, mode, linkType, redirectTo } =
    (await request.json()) as RowInviteRequest;

  if (!accountId) {
    return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 });
  }

  const adminClient = getFamilyInviteAdminClient();

  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .select('email')
    .eq('id', accountId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ email?: string | null }>();

  if (accountError) {
    return NextResponse.json({ success: false, message: accountError.message }, { status: 500 });
  }

  if (!account?.email) {
    return NextResponse.json({ success: false, message: 'Account or email not found' }, { status: 404 });
  }

  const formData = new FormData();
  formData.set('email', account.email);
  formData.set('profileKind', profileKind ?? 'guardian');
  formData.set('mode', mode ?? 'link');
  formData.set('linkType', linkType ?? (mode === 'link' ? 'magiclink' : 'invite'));
  if (redirectTo) {
    formData.set('redirectTo', redirectTo);
  }

  try {
    const payload = await inviteAdminUserAction(formData);
    return NextResponse.json({ success: true, payload });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
