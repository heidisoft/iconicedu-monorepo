import { NextResponse } from 'next/server';

import { buildAccountById } from '@iconicedu/web/lib/accounts/builders/account.builder';
import {
  getAccountByAuthUserId,
  getAccountById,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  buildUserProfileByAccountId,
  buildUserProfileById,
} from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('accountId')?.trim() ?? '';
  const profileId = url.searchParams.get('profileId')?.trim() ?? '';

  if (!accountId && !profileId) {
    return NextResponse.json(
      { success: false, message: 'accountId or profileId is required' },
      { status: 400 },
    );
  }

  try {
    const sessionSupabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await sessionSupabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    const actorAccountResponse = await getAccountByAuthUserId(
      sessionSupabase,
      authUser.id,
    );

    if (!actorAccountResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const targetProfile = profileId
      ? await buildUserProfileById(serviceSupabase, profileId)
      : null;
    const resolvedAccountId = accountId || targetProfile?.ids.accountId || '';

    if (!resolvedAccountId) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 },
      );
    }

    const targetAccountResponse = await getAccountById(
      sessionSupabase,
      resolvedAccountId,
    );

    if (!targetAccountResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 },
      );
    }

    if (targetAccountResponse.data.org_id !== actorAccountResponse.data.org_id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const [account, profile] = await Promise.all([
      buildAccountById(
        serviceSupabase,
        resolvedAccountId,
        targetAccountResponse.data.org_id,
        targetAccountResponse.data.email ?? null,
      ),
      targetProfile
        ? Promise.resolve(targetProfile)
        : buildUserProfileByAccountId(serviceSupabase, resolvedAccountId, {
            accountEmail: targetAccountResponse.data.email ?? null,
            includeFamilyInvites: true,
          }),
    ]);

    return NextResponse.json({
      success: true,
      payload: {
        account,
        profile,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to load profile preview',
      },
      { status: 500 },
    );
  }
}
