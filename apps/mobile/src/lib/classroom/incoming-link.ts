import { rememberNativeInvitation, nativeHandoffRedemptionKey } from './link-recovery';
import { publicApiPost } from '@/lib/api/http-client';

let entrySequence = 0;

/** Rewrite OS links before navigation so invitation capabilities never enter route params. */
export async function redirectClassroomLink(
  path: string,
  webOrigin?: string,
): Promise<string> {
  try {
    const origin =
      webOrigin ??
      (process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://app.iconicedu.com');
    const url = new URL(path, origin);
    const native = url.protocol === 'iconicedu:';
    if (!native && url.origin !== new URL(origin).origin) return '/';
    // iconicedu://live/id and iconicedu:///live/id are both supported.
    const pathname =
      native && url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
    const match = /^\/live\/([a-zA-Z0-9-]{1,128})\/?$/.exec(pathname);
    if (!match) {
      if (pathname.startsWith('/live/')) return '/classroom-link-error';
      return native || path.startsWith('/') ? path : '/';
    }
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (fragment.has('handoff')) {
      // Personal browser handoffs are redeemed through the same API contract as web.
      const result = await publicApiPost<{ linkToken: string }>(
        `/live-sessions/${encodeURIComponent(match[1])}/link-info`,
        {
          token: fragment.get('handoff'),
          handoff: true,
          redemptionKey: await nativeHandoffRedemptionKey(
            match[1],
            fragment.get('handoff')!,
          ),
        },
      );
      await rememberNativeInvitation(match[1], result.linkToken);
    } else {
      const token = fragment.get('invite');
      if (token) await rememberNativeInvitation(match[1], token);
    }
    return `/classroom/${match[1]}?entry=${Date.now()}-${++entrySequence}`;
  } catch {
    return '/classroom-link-error';
  }
}
