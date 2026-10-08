import type {
  AnnotationCommit,
  AnnotationContext,
  AnnotationOperation,
} from '@iconicedu/shared-types';
import {
  createApiClient,
  createPublicApiClient,
} from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
export const annotationApi = (token?: string) => {
  const api = token
    ? createPublicApiClient(token)
    : createApiClient(createSupabaseBrowserClient());
  const prefix = token ? '/screen-annotations/guest' : '/screen-annotations';
  return {
    context: (sessionId: string, shareKey: string) =>
      api.get<AnnotationContext>(`${prefix}/${encodeURIComponent(sessionId)}`, {
        shareKey,
      }),
    apply: (roomId: string, operation: AnnotationOperation) =>
      api.post<AnnotationCommit>(
        `${prefix}/${encodeURIComponent(roomId)}/operations`,
        operation,
      ),
  };
};
