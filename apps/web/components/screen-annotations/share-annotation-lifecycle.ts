import type {
  AnnotationContext,
  AnnotationOperation,
  AnnotationCommit,
} from '@iconicedu/shared-types';
/** View changes do not end a share. Only actual SDK share-stop events close its room. */
export function createShareAnnotationLifecycle(
  apply: (roomId: string, operation: AnnotationOperation) => Promise<AnnotationCommit>,
) {
  const rooms = new Map<string, string>();
  const pending = new Map<string, Promise<void>>();
  return {
    remember(shareKey: string, context: AnnotationContext) {
      if (context.actor.role === 'educator' && !context.snapshot.ended)
        rooms.set(shareKey, context.snapshot.roomId);
    },
    end(shareKey: string): Promise<void> {
      const roomId = rooms.get(shareKey);
      if (!roomId) return Promise.resolve();
      const existing = pending.get(roomId);
      if (existing) return existing;
      const request = Promise.resolve()
        .then(async () => {
          await apply(roomId, { eventId: crypto.randomUUID(), kind: 'end' });
          if (rooms.get(shareKey) === roomId) rooms.delete(shareKey);
        })
        .finally(() => pending.delete(roomId));
      pending.set(roomId, request);
      return request;
    },
  };
}
