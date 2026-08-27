import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

import {
  getAccountByAuthUserIdInOrg,
  getProfileByIdInOrg,
  getProfilesByAccountId,
} from '@iconicedu/api/lib/profiles/profiles.query';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

export type LiveSessionActor = {
  authUserId: string;
  account: AccountRow;
  profile: ProfileRow;
};

/**
 * Resolve the org from whichever identifier the caller has.
 *
 * Web routes address the org by slug (it is in the URL); mobile only ever holds
 * the id. Both are looked up here so the slug is always available for building
 * join paths, and neither is trusted for access — the actor's account membership
 * in the resolved org is checked separately.
 */
async function resolveOrg(input: {
  supabase: SupabaseServiceClient;
  orgSlug?: string | null;
  orgId?: string | null;
}) {
  const query = input.supabase.from('orgs').select('id, slug').is('deleted_at', null);
  const scoped = input.orgSlug
    ? query.eq('slug', input.orgSlug)
    : input.orgId
      ? query.eq('id', input.orgId)
      : null;

  if (!scoped) {
    throw new NotFoundException('Organization not found');
  }

  const response = await scoped.maybeSingle<{ id: string; slug: string }>();
  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? null;
}

/**
 * Pick the profile a live-session join is attributed to.
 *
 * A guardian browsing in "viewing as child" mode acts as that child, so the web
 * layer passes the child's `actingProfileId`. That value is never trusted as
 * given: it is accepted only when it belongs to the caller's own account, and the
 * guardian→child case is authorized separately against `family_links` by the join
 * service. Anything else is a cross-actor impersonation attempt.
 */
async function resolveActingProfile(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  account: AccountRow;
  actingProfileId?: string | null;
}): Promise<ProfileRow> {
  const ownProfilesResponse = await getProfilesByAccountId(
    input.supabase,
    input.orgId,
    input.account.id,
  );
  if (ownProfilesResponse.error) {
    throw new Error(ownProfilesResponse.error.message);
  }
  const ownProfiles = ownProfilesResponse.data ?? [];

  const actingProfileId = input.actingProfileId?.trim();
  if (!actingProfileId) {
    const profile = ownProfiles[0];
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  const ownProfile = ownProfiles.find((candidate) => candidate.id === actingProfileId);
  if (ownProfile) {
    return ownProfile;
  }

  // A guardian may act as a linked child. Confirm the link before accepting it.
  const linkedResponse = await input.supabase
    .from('family_links')
    .select('child_account_id')
    .eq('org_id', input.orgId)
    .eq('guardian_account_id', input.account.id)
    .is('deleted_at', null)
    .returns<Array<{ child_account_id: string | null }>>();

  if (linkedResponse.error) {
    throw new Error(linkedResponse.error.message);
  }

  const childAccountIds = new Set(
    (linkedResponse.data ?? [])
      .map((row) => row.child_account_id)
      .filter((value): value is string => Boolean(value)),
  );

  const candidateResponse = await getProfileByIdInOrg(
    input.supabase,
    input.orgId,
    actingProfileId,
  );
  if (candidateResponse.error) {
    throw new Error(candidateResponse.error.message);
  }

  const candidate = candidateResponse.data;
  if (!candidate || !candidate.account_id || !childAccountIds.has(candidate.account_id)) {
    throw new ForbiddenException('Unauthorized');
  }

  return candidate;
}

export async function resolveLiveSessionActor(input: {
  supabase: SupabaseServiceClient;
  authUserId: string;
  orgSlug?: string | null;
  orgId?: string | null;
  actingProfileId?: string | null;
}): Promise<LiveSessionActor & { orgId: string; orgSlug: string }> {
  const org = await resolveOrg({
    supabase: input.supabase,
    orgSlug: input.orgSlug,
    orgId: input.orgId,
  });
  if (!org) {
    throw new NotFoundException('Organization not found');
  }
  const orgId = org.id;

  const accountResponse = await getAccountByAuthUserIdInOrg(
    input.supabase,
    input.authUserId,
    orgId,
  );
  if (accountResponse.error) {
    throw new Error(accountResponse.error.message);
  }

  const account = accountResponse.data;
  if (!account) {
    // The caller is authenticated but has no account in this organization, so the
    // occurrence is not theirs to see. Answering "not found" keeps cross-tenant
    // probing from confirming that an org slug exists.
    throw new ForbiddenException('Unauthorized');
  }

  const profile = await resolveActingProfile({
    supabase: input.supabase,
    orgId,
    account,
    actingProfileId: input.actingProfileId,
  });

  return { authUserId: input.authUserId, account, profile, orgId, orgSlug: org.slug };
}
