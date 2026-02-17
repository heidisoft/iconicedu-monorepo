'use server';

import type { AccountRow } from '@iconicedu/shared-types';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  getAccountByAuthUserId,
  getAccountByEmail,
  insertInvitedAccount,
  updateAccountStatus,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  insertProfileForAccount,
  upsertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';
import { pickRandomThemeKey } from '@iconicedu/web/lib/profile/constants/theme';

const VALID_PROFILE_KINDS = new Set(['guardian', 'staff', 'educator', 'child']);

type InviteUserResult = {
  email: string;
  inviteUrl: string;
  actionLink?: string | null;
};

function buildRedirectUrl(profileKind: string, baseUrl: string) {
  const sanitizedBase = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ profileKind });
  return `${sanitizedBase}/auth/callback?${params.toString()}`;
}

async function resolveBaseUrl() {
  const headerStore = await headers();
  const forwardedHost =
    headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? undefined;
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    return `${protocol}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function inviteAdminUserAction(
  formData: FormData,
): Promise<InviteUserResult> {
  const emailInput = String(formData.get('email') ?? '').trim();
  const profileKindInput = String(formData.get('profileKind') ?? '').trim();
  if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    throw new Error('Valid email is required.');
  }
  if (!VALID_PROFILE_KINDS.has(profileKindInput)) {
    throw new Error('Valid profile kind is required.');
  }
  const parsed = {
    email: emailInput,
    profileKind: profileKindInput as 'guardian' | 'staff' | 'educator' | 'child',
  };
  const mode = (formData.get('mode') as 'invite' | 'link') ?? 'link';
  const linkType = (formData.get('linkType') as 'invite' | 'magiclink') ?? 'invite';

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    throw new Error('Unauthorized');
  }

  const accountResponse = await getAccountByAuthUserId(supabase, userData.user.id);
  if (!accountResponse.data) {
    throw new Error('Account record not found');
  }

  const adminClient = getFamilyInviteAdminClient();
  const normalizedEmail = parsed.email.toLowerCase();

  const existingAccountResponse = await getAccountByEmail(
    adminClient,
    ORG_ID,
    normalizedEmail,
  );

  if (existingAccountResponse.error) {
    throw existingAccountResponse.error;
  }

  let targetAccount: AccountRow | null | undefined = existingAccountResponse.data;

  if (!targetAccount) {
    const { data: insertedAccount, error: insertError } = await insertInvitedAccount(
      adminClient,
      {
        orgId: ORG_ID,
        email: normalizedEmail,
        createdBy: accountResponse.data.id,
      },
    );

    if (insertError || !insertedAccount) {
      throw insertError ?? new Error('Unable to create account.');
    }

    targetAccount = insertedAccount;
  }

  if (!targetAccount?.id) {
    throw new Error('Unable to resolve invited account.');
  }

  if (mode === 'invite') {
    if (targetAccount.status === 'active') {
      throw new Error('Account already active; no invite sent.');
    }

    const { error: statusError } = await updateAccountStatus(
      adminClient,
      targetAccount.id,
      ORG_ID,
      'invited',
      accountResponse.data.id,
    );

    if (statusError) {
      throw statusError;
    }
  }

  const { error: upsertError } = await upsertProfileForAccount(adminClient, {
    orgId: ORG_ID,
    accountId: targetAccount.id,
    kind: parsed.profileKind,
    avatarSource: 'seed',
    avatarUrl: null,
    avatarSeed: targetAccount.id,
    timezone: 'UTC',
    locale: 'en-US',
    status: 'invited',
    uiThemeKey: parsed.profileKind === 'guardian' ? pickRandomThemeKey() : 'teal',
  });

  if (upsertError?.code === '42P10') {
    const { error: insertError } = await insertProfileForAccount(adminClient, {
      orgId: ORG_ID,
      accountId: targetAccount.id,
      kind: parsed.profileKind,
      avatarSource: 'seed',
      avatarUrl: null,
      avatarSeed: targetAccount.id,
      timezone: 'UTC',
      locale: 'en-US',
      status: 'invited',
      uiThemeKey: parsed.profileKind === 'guardian' ? pickRandomThemeKey() : 'teal',
    });
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }
  } else if (upsertError?.code === '23505') {
    // profile already exists, no action needed
  } else if (upsertError) {
    throw upsertError;
  }

  const redirectOverride = formData.get('redirectTo') as string | null;

  const redirectTo =
    redirectOverride && redirectOverride.trim()
      ? redirectOverride
      : buildRedirectUrl(parsed.profileKind, await resolveBaseUrl());

  if (mode === 'invite') {
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.generateLink({
        type: linkType,
        email: normalizedEmail,
        options: { redirectTo },
      });

    if (inviteError) {
      throw inviteError;
    }

    const actionLink = inviteData?.properties?.action_link ?? redirectTo;

    await reconcileInvitedAccount({
      client: adminClient,
      orgId: ORG_ID,
      accountId: targetAccount.id,
      email: normalizedEmail,
      updatedBy: accountResponse.data.id,
    });

    return {
      email: normalizedEmail,
      inviteUrl: actionLink,
      actionLink,
    };
  }

  const { error: otpError } = await adminClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: redirectTo },
  });

  if (otpError) {
    throw otpError;
  }

  const { data: generatedLink, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: linkType,
      email: normalizedEmail,
      options: { redirectTo },
    });

  if (linkError) {
    throw linkError;
  }

  const actionLink =
    generatedLink?.properties?.action_link ?? redirectTo;
  if (!actionLink) {
    throw new Error('Supabase did not return an invite action link.');
  }
  return {
    email: normalizedEmail,
    inviteUrl: actionLink,
    actionLink,
  };
}

type ReconcileInvitedAccountOptions = {
  client: SupabaseClient;
  orgId: string;
  accountId: string;
  email: string;
  updatedBy: string;
  authUserId?: string;
};

async function reconcileInvitedAccount(options: ReconcileInvitedAccountOptions) {
  const updates: Record<string, unknown> = {
    status: 'invited',
    updated_by: options.updatedBy,
  };

  if (options.authUserId) {
    updates.auth_user_id = options.authUserId;
  }

  const { error: updateError } = await options.client
    .from('accounts')
    .update(updates)
    .eq('id', options.accountId)
    .eq('org_id', options.orgId)
    .is('deleted_at', null);

  if (updateError) {
    throw updateError;
  }

  const { error: deleteError } = await options.client
    .from('accounts')
    .delete()
    .eq('org_id', options.orgId)
    .ilike('email', options.email)
    .not('auth_user_id', 'is', null)
    .neq('id', options.accountId)
    .is('deleted_at', null);

  if (deleteError) {
    throw deleteError;
  }
}
