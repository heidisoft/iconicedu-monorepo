import type {
  AnnotationCommit,
  AnnotationContext,
  AnnotationOperation,
  AnnotationPointerInput,
  AnnotationLaserStroke,
} from '@iconicedu/shared-types';
import { apiGet, apiPost, capabilityGet, capabilityPost } from '@/lib/api/http-client';
export function nativeAnnotationApi(sessionId: string, shareKey: string, token?: string) {
  const prefix = token ? '/screen-annotations/guest' : '/screen-annotations';
  const contextPath = `${prefix}/${encodeURIComponent(sessionId)}?shareKey=${encodeURIComponent(shareKey)}`;
  return {
    laser: (strokes: AnnotationLaserStroke[]) =>
      token
        ? capabilityPost<void>(
            `${prefix}/${encodeURIComponent(sessionId)}/laser?shareKey=${encodeURIComponent(shareKey)}`,
            token,
            strokes,
          )
        : apiPost<void>(
            `${prefix}/${encodeURIComponent(sessionId)}/laser?shareKey=${encodeURIComponent(shareKey)}`,
            strokes,
          ),
    load: () =>
      token
        ? capabilityGet<AnnotationContext>(contextPath, token)
        : apiGet<AnnotationContext>(contextPath),
    save: (roomId: string, operation: AnnotationOperation) =>
      token
        ? capabilityPost<AnnotationCommit>(
            `${prefix}/${encodeURIComponent(roomId)}/operations`,
            token,
            operation,
          )
        : apiPost<AnnotationCommit>(
            `${prefix}/${encodeURIComponent(roomId)}/operations`,
            operation,
          ),
    pointer: (input: AnnotationPointerInput) =>
      token
        ? capabilityPost<void>(
            `${prefix}/${encodeURIComponent(sessionId)}/pointer?shareKey=${encodeURIComponent(shareKey)}`,
            token,
            input,
          )
        : apiPost<void>(
            `${prefix}/${encodeURIComponent(sessionId)}/pointer?shareKey=${encodeURIComponent(shareKey)}`,
            input,
          ),
  };
}
