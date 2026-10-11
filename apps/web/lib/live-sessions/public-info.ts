import type { PublicLiveSessionInfoVM } from '@iconicedu/shared-types';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';

export type PublicLiveSessionInfo = PublicLiveSessionInfoVM;

/** API owns session existence, authenticated identity and host authorization. */
export function getPublicLiveSessionInfo(sessionId: string, accessToken: string | null) {
  return createPublicApiClient(accessToken).get<PublicLiveSessionInfo>(
    `/live-sessions/${encodeURIComponent(sessionId)}/public-info`,
    undefined,
    { cache: 'no-store' },
  );
}
