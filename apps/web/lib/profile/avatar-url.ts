import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveAvatarSource } from '@iconicedu/web/lib/profile/derive';
import {
  createPublicAvatarUrl,
  createSignedAvatarUrl,
} from '@iconicedu/web/lib/profile/queries/avatar.query';

export async function resolveProfileAvatarUrl(
  supabase: SupabaseClient,
  avatarSource: string,
  avatarUrl: string | null,
): Promise<string | null> {
  if (!avatarUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }

  if (resolveAvatarSource(avatarSource) !== 'upload') {
    return avatarUrl;
  }

  const { data, error } = await createSignedAvatarUrl(supabase, avatarUrl);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const { data: publicData } = createPublicAvatarUrl(supabase, avatarUrl);
  return publicData?.publicUrl ?? null;
}

