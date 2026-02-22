import type { SupabaseClient } from '@supabase/supabase-js';

import { AVATAR_BUCKET, AVATAR_SIGNED_URL_TTL } from '@iconicedu/web/lib/profile/constants/theme';

export async function createSignedAvatarUrl(
  supabase: SupabaseClient,
  avatarPath: string,
) {
  return supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL);
}

export function createPublicAvatarUrl(
  supabase: SupabaseClient,
  avatarPath: string,
) {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
}
