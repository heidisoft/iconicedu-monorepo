import type {
  WhiteboardOperationVM,
  WhiteboardSnapshotVM,
} from '@iconicedu/shared-types';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
export interface WhiteboardRepository {
  load(): Promise<WhiteboardSnapshotVM>;
  save(operation: WhiteboardOperationVM): Promise<WhiteboardSnapshotVM>;
}
/** Capability-authenticated endpoints explicitly accept public transport. */
export function createWhiteboardRepository(token: string): WhiteboardRepository {
  const client = createPublicApiClient(token);
  let cached: WhiteboardSnapshotVM | null = null;
  return {
    async load() {
      const response = await client.get<
        WhiteboardSnapshotVM | Omit<WhiteboardSnapshotVM, 'document'>
      >('/whiteboards/current', { revision: cached?.revision });
      if (cached && response.revision < cached.revision) return cached;
      if ('document' in response) cached = response;
      else if (cached) cached = { ...cached, ...response };
      else throw new Error('Whiteboard could not be restored');
      return cached;
    },
    async save(op) {
      const response = await client.post<WhiteboardSnapshotVM>(
        '/whiteboards/current/operations',
        op,
      );
      cached = response;
      return response;
    },
  };
}
