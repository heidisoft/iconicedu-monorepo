import { randomUUID } from 'crypto';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import type { LearningSpaceResourcePayload } from '@iconicedu/shared-types';

export async function replaceLearningSpaceLinks(
  learningSpaceId: string,
  links: LearningSpaceResourcePayload[],
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }
  const profileId = profileResponse.data.id;

  const orgId = accountResponse.data.org_id;
  const now = new Date().toISOString();

  const serviceClient = createSupabaseServiceClient();

  await ensureDeleted(
    serviceClient
      .from('learning_space_links')
      .delete()
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId),
  );

  const sanitizedLinks = links
    .map((link) => ({
      label: link.label?.trim(),
      iconKey: link.iconKey ?? null,
      url: link.url ?? null,
      status: link.status ?? 'active',
      hidden: link.hidden ?? null,
    }))
    .filter((link) => Boolean(link.label));

  if (!sanitizedLinks.length) {
    return;
  }

  const rows = sanitizedLinks.map((link) => ({
    id: randomUUID(),
    org_id: orgId,
    learning_space_id: learningSpaceId,
    label: link.label,
    icon_key: link.iconKey,
    url: link.url,
    status: link.status,
    hidden: link.hidden,
    created_at: now,
    created_by: profileId,
    updated_at: now,
    updated_by: profileId,
  }));

  const { data, error } = await serviceClient
    .from('learning_space_links')
    .insert(rows)
    .select('id');
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error('Unable to insert class links.');
  }
}

async function ensureDeleted(
  request: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await request;
  if (error) {
    throw new Error(error.message);
  }
}
