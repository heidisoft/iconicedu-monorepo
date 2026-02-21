import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { updateAccountStatus } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';

export async function POST() {
  const sessionSupabase = await createSupabaseServerClient();
  const { data } = await sessionSupabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceSupabase = createSupabaseServiceClient();

  try {
    const { account } = await getOrCreateAccount(serviceSupabase, {
      orgId: ORG_ID,
      authUserId: data.user.id,
      authEmail: data.user.email ?? null,
    });

    const statusResponse = await updateAccountStatus(
      serviceSupabase,
      account.id,
      ORG_ID,
      'active',
      data.user.id,
    );
    const activeAccount = statusResponse.data ?? account;
    const rolesResponse = await getUserRoles(serviceSupabase, account.id, ORG_ID);
    if (rolesResponse.error) {
      throw rolesResponse.error;
    }
    const onboarding = buildAuthOnboardingState(activeAccount, rolesResponse.data ?? []);

    return NextResponse.json({
      status: 'active',
      onboarding,
    });
  } catch (error) {
    console.error('activate-account', error);
    return NextResponse.json(
      { error: 'Unable to activate account' },
      { status: 500 },
    );
  }
}
