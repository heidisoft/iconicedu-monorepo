/**
 * Profile photos live in the private `public-avatars` bucket. `profiles.avatar_url`
 * holds either the storage object path (what web and current mobile builds write)
 * or, for photos saved by older mobile builds, the bucket's `/object/public/` URL,
 * which a private bucket refuses. Both must be exchanged for a signed URL before
 * an `<Image>` can load them. External URLs, already signed URLs and local picker
 * URIs are used unchanged.
 */
export const AVATAR_BUCKET = 'public-avatars';
export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
// Refresh a little before Supabase expires the signature.
const CACHE_TTL_MS = (AVATAR_SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000;

type Signer = (path: string) => Promise<string | null>;

const cache = new Map<string, { url: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<string | null>>();

/** Returns the storage path to sign, or null when `raw` can be loaded as-is. */
export function avatarStoragePath(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^(file|content|ph|assets-library|data|blob):/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    const index = value.indexOf(PUBLIC_OBJECT_MARKER);
    if (index === -1) return null;
    const path = value.slice(index + PUBLIC_OBJECT_MARKER.length).split('?')[0];
    return path ? decodeURIComponent(path) : null;
  }
  return value.replace(/^\/+/, '');
}

/** Synchronously available display URI (unchanged or cached), else undefined. */
export function peekAvatarUri(
  raw: string | null | undefined,
  now = Date.now(),
): string | null | undefined {
  const value = raw?.trim();
  if (!value) return null;
  const path = avatarStoragePath(value);
  if (!path) return value;
  const hit = cache.get(path);
  return hit && hit.expiresAt > now ? hit.url : undefined;
}

export async function resolveAvatarUri(
  raw: string | null | undefined,
  sign: Signer,
): Promise<string | null> {
  const ready = peekAvatarUri(raw);
  if (ready !== undefined) return ready;
  const path = avatarStoragePath(raw)!;
  const pending = inFlight.get(path);
  if (pending) return pending;
  const request = sign(path)
    .catch(() => null)
    .then((url) => {
      if (url) cache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS });
      return url;
    })
    .finally(() => inFlight.delete(path));
  inFlight.set(path, request);
  return request;
}

export function clearAvatarUriCache() {
  cache.clear();
  inFlight.clear();
}
