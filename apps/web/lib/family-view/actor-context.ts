import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import {
  getAccountByAuthUserId,
  getAccountByAuthUserIdInOrg,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  resolveEffectiveProfileForAccountInOrg,
  resolveEffectiveProfileForAuthUserInOrg,
} from '@iconicedu/web/lib/family-view/effective-profile';

export type EffectiveActorContext = {
  authUserId: string;
  account: AccountRow;
  profile: ProfileRow;
  isViewingAsChild: boolean;
};

export class ParentModeRequiredError extends Error {
  constructor(message = 'Switch back to Parent to perform this action.') {
    super(message);
    this.name = 'ParentModeRequiredError';
  }
}

export function assertParentMode(actor: EffectiveActorContext): EffectiveActorContext {
  if (actor.isViewingAsChild) {
    throw new ParentModeRequiredError();
  }

  return actor;
}

export async function requireEffectiveActorContext(
  supabase: SupabaseClient,
  input?: { orgId?: string },
): Promise<EffectiveActorContext> {
  const authUser = await requireAuthedUser(supabase);

  if (input?.orgId) {
    const resolved = await resolveEffectiveProfileForAuthUserInOrg(supabase, {
      authUserId: authUser.id,
      orgId: input.orgId,
    });

    return {
      authUserId: authUser.id,
      account: resolved.account,
      profile: resolved.effectiveProfile,
      isViewingAsChild: resolved.isViewingAsChild,
    };
  }

  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  const account = accountResponse.data;
  if (!account) {
    throw new Error('Account not found');
  }

  const resolved = await resolveEffectiveProfileForAccountInOrg(supabase, {
    account,
    authUserId: authUser.id,
  });

  return {
    authUserId: authUser.id,
    account: resolved.account,
    profile: resolved.effectiveProfile,
    isViewingAsChild: resolved.isViewingAsChild,
  };
}

export async function requireParentActorContext(
  supabase: SupabaseClient,
  input?: { orgId?: string },
): Promise<EffectiveActorContext> {
  const actor = await requireEffectiveActorContext(supabase, input);
  return assertParentMode(actor);
}

export async function requireEffectiveActorContextInOrg(
  supabase: SupabaseClient,
  input: {
    authUserId: string;
    orgId: string;
  },
): Promise<EffectiveActorContext> {
  const accountResponse = await getAccountByAuthUserIdInOrg(
    supabase,
    input.authUserId,
    input.orgId,
  );
  const account = accountResponse.data;
  if (!account) {
    throw new Error('Account not found');
  }

  const resolved = await resolveEffectiveProfileForAccountInOrg(supabase, {
    account,
    authUserId: input.authUserId,
  });

  return {
    authUserId: input.authUserId,
    account: resolved.account,
    profile: resolved.effectiveProfile,
    isViewingAsChild: resolved.isViewingAsChild,
  };
}

export async function requireParentActorContextInOrg(
  supabase: SupabaseClient,
  input: {
    authUserId: string;
    orgId: string;
  },
): Promise<EffectiveActorContext> {
  const actor = await requireEffectiveActorContextInOrg(supabase, input);
  return assertParentMode(actor);
}
