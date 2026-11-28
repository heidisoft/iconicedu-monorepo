import type { SupabaseClient } from '@supabase/supabase-js';

import { AVATAR_BUCKET } from '@iconicedu/web/lib/profile/constants/theme';
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

  // Older mobile builds saved the private bucket's `/object/public/` URL, which
  // never loads; sign the object path it points at instead.
  const legacyMarker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const legacyIndex = avatarUrl.indexOf(legacyMarker);
  const path =
    legacyIndex !== -1 && /^https?:\/\//i.test(avatarUrl)
      ? decodeURIComponent(
          avatarUrl.slice(legacyIndex + legacyMarker.length).split('?')[0]!,
        )
      : avatarUrl;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (resolveAvatarSource(avatarSource) !== 'upload') {
    return path;
  }

  const { data, error } = await createSignedAvatarUrl(supabase, path);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const { data: publicData } = createPublicAvatarUrl(supabase, path);
  return publicData?.publicUrl ?? null;
}
