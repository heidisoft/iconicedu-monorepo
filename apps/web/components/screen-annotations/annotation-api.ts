import type {
  AnnotationCommit,
  AnnotationContext,
  AnnotationOperation,
} from '@iconicedu/shared-types';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
export const annotationApi = () => {
  const api = createApiClient(createSupabaseBrowserClient());
  return {
    context: (sessionId: string, shareKey: string) =>
      api.get<AnnotationContext>(`/screen-annotations/${encodeURIComponent(sessionId)}`, {
        shareKey,
      }),
    apply: (roomId: string, operation: AnnotationOperation) =>
      api.post<AnnotationCommit>(
        `/screen-annotations/${encodeURIComponent(roomId)}/operations`,
        operation,
      ),
  };
};
