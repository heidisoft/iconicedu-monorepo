'use server';

import { revalidatePath } from 'next/cache';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import {
  clearFamilyViewCookie,
  setFamilyViewCookie,
} from '@iconicedu/web/lib/family-view/context';
import { resolveEffectiveProfileForAuthUserInOrg } from '@iconicedu/web/lib/family-view/effective-profile';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type SwitchFamilyViewInput = {
  orgId: string;
  orgSlug: string;
  childProfileId: string | null;
};

export async function switchFamilyViewAction(input: SwitchFamilyViewInput) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);

  const resolved = await resolveEffectiveProfileForAuthUserInOrg(supabase, {
    authUserId: authUser.id,
    orgId: input.orgId,
  });

  if (!resolved.guardianProfile || resolved.guardianProfile.kind !== 'guardian') {
    throw new Error('Only parent profiles can switch family view.');
  }

  if (!input.childProfileId) {
    await clearFamilyViewCookie();
    revalidatePath(`/${input.orgSlug}`);
    return {
      success: true as const,
      viewingAsChild: false,
      profileId: resolved.guardianProfile.id,
    };
  }

  const selectedChild = resolved.linkedChildProfiles.find(
    (profile) => profile.id === input.childProfileId,
  );
  if (!selectedChild || selectedChild.kind !== 'child') {
    throw new Error('Selected student is not linked to this parent.');
  }
  if (selectedChild.status && selectedChild.status !== 'active') {
    throw new Error('Selected student profile is not active.');
  }

  await setFamilyViewCookie({
    orgId: input.orgId,
    guardianAccountId: resolved.guardianProfile.account_id,
    childProfileId: selectedChild.id,
  });

  revalidatePath(`/${input.orgSlug}`);
  return {
    success: true as const,
    viewingAsChild: true,
    profileId: selectedChild.id,
  };
}
