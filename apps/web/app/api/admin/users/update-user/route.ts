import { NextResponse } from 'next/server';

import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';

type UpdateUserRequestBody = {
  accountId?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
};

const normalizeNullableField = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  const body = (await request.json()) as UpdateUserRequestBody;
  const accountId = body.accountId?.trim();
  const normalizedEmail = body.email?.trim().toLowerCase() ?? '';
  const normalizedDisplayName = normalizeNullableField(body.displayName);
  const normalizedFirstName = normalizeNullableField(body.firstName);
  const normalizedLastName = normalizeNullableField(body.lastName);

  if (!accountId) {
    return NextResponse.json(
      { success: false, message: 'accountId is required' },
      { status: 400 },
    );
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return NextResponse.json(
      { success: false, message: 'Valid email is required' },
      { status: 400 },
    );
  }

  const adminClient = getFamilyInviteAdminClient();
  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .select('id, org_id, auth_user_id, email')
    .eq('id', accountId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{
      id: string;
      org_id: string;
      auth_user_id?: string | null;
      email?: string | null;
    }>();

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

  const { data: conflictingAccount, error: conflictError } = await adminClient
    .from('accounts')
    .select('id')
    .eq('org_id', account.org_id)
    .ilike('email', normalizedEmail)
    .neq('id', account.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (conflictError) {
    return NextResponse.json(
      { success: false, message: conflictError.message },
      { status: 500 },
    );
  }

  if (conflictingAccount) {
    return NextResponse.json(
      { success: false, message: 'Email is already used by another account' },
      { status: 409 },
    );
  }

  const { error: accountUpdateError } = await adminClient
    .from('accounts')
    .update({ email: normalizedEmail })
    .eq('id', account.id)
    .eq('org_id', account.org_id);

  if (accountUpdateError) {
    return NextResponse.json(
      { success: false, message: accountUpdateError.message },
      { status: 500 },
    );
  }

  if (account.auth_user_id && account.email?.toLowerCase() !== normalizedEmail) {
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      account.auth_user_id,
      { email: normalizedEmail },
    );
    if (authUpdateError) {
      return NextResponse.json(
        { success: false, message: authUpdateError.message },
        { status: 500 },
      );
    }
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({
      display_name: normalizedDisplayName,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
    })
    .eq('account_id', account.id)
    .eq('org_id', account.org_id)
    .is('deleted_at', null);

  if (profileUpdateError) {
    return NextResponse.json(
      { success: false, message: profileUpdateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
