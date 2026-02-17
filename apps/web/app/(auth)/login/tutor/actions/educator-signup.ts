'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { pickRandomThemeKey } from '@iconicedu/web/lib/profile/constants/theme';

type EducatorSignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
};

export function resolveSignupDisplayName(input: {
  displayName?: string;
  firstName: string;
  lastName: string;
}): string {
  const displayName = input.displayName?.trim() ?? '';
  if (displayName) {
    return displayName;
  }
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!lastName) {
    return firstName;
  }
  return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
}

export async function educatorSignupAction(input: EducatorSignupInput) {
  const adminClient = getFamilyInviteAdminClient();

  const { data: user, error: createUserError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    user_metadata: {
      full_name: `${input.firstName} ${input.lastName}`.trim(),
    },
    email_confirm: true,
  });

  if (createUserError || !user) {
    throw createUserError ?? new Error('Unable to create educator user.');
  }

  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .insert({
      org_id: ORG_ID,
      auth_user_id: user.id,
      email: input.email,
      status: 'active',
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (accountError || !account) {
    throw accountError ?? new Error('Unable to create educator account.');
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    org_id: ORG_ID,
    account_id: account.id,
    kind: 'educator',
    display_name: resolveSignupDisplayName(input),
    first_name: input.firstName,
    last_name: input.lastName,
    avatar_source: 'seed',
    avatar_url: null,
    avatar_seed: account.id,
    ui_theme_key: pickRandomThemeKey(),
    timezone: 'UTC',
    locale: 'en-US',
    status: 'active',
    created_by: user.id,
    updated_by: user.id,
  });

  if (profileError) {
    throw profileError;
  }

  return 'Educator account created';
}
