import type { SupabaseClient } from '@supabase/supabase-js';
import { getChannelFilesBucket } from '@iconicedu/web/lib/storage/storage-paths';

export const CHANNEL_FILE_BUCKET = getChannelFilesBucket();
export const CHANNEL_FILE_SIGNED_URL_TTL = 60 * 60;

function isAbsoluteUrl(pathOrUrl: string) {
  return /^https?:\/\//i.test(pathOrUrl);
}

export async function createSignedChannelFileUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
): Promise<string> {
  if (!pathOrUrl) {
    return '';
  }
  if (isAbsoluteUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  const signedResponse = await supabase.storage
    .from(CHANNEL_FILE_BUCKET)
    .createSignedUrl(pathOrUrl, CHANNEL_FILE_SIGNED_URL_TTL);

  if (signedResponse.error || !signedResponse.data?.signedUrl) {
    throw new Error(signedResponse.error?.message ?? 'Unable to create file URL');
  }

  return signedResponse.data.signedUrl;
}
