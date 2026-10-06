import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import type { WhiteboardRepository } from '@iconicedu/web/lib/whiteboard/api';
export type CollaborationStatus = 'connecting' | 'connected' | 'reconnecting';
export interface WhiteboardCollaborationProvider {
  connect(
    onSnapshot: (snapshot: WhiteboardSnapshotVM) => void,
    onStatus: (status: CollaborationStatus) => void,
  ): () => void;
  refresh(): void;
}
/** HTTP is the baseline transport, including anonymous guests. No canvas/vendor coupling.
 * Only one request can run at a time. Reconnect always reloads authoritative state.
 * Realtime invalidation can call refresh without changing persistence or presentation.
 */
export class HttpWhiteboardCollaborationProvider implements WhiteboardCollaborationProvider {
  private refreshNow = () => {};
  constructor(
    private readonly repository: WhiteboardRepository,
    private readonly interval = 1500,
  ) {}
  refresh() {
    this.refreshNow();
  }
  connect(
    onSnapshot: (snapshot: WhiteboardSnapshotVM) => void,
    onStatus: (status: CollaborationStatus) => void,
  ) {
    let disposed = false,
      loading = false;
    const sync = async () => {
      if (disposed || loading) return;
      loading = true;
      try {
        const snapshot = await this.repository.load();
        if (!disposed) {
          onSnapshot(snapshot);
          onStatus('connected');
        }
      } catch {
        if (!disposed) onStatus('reconnecting');
      } finally {
        loading = false;
      }
    };
    onStatus('connecting');
    this.refreshNow = () => void sync();
    void sync();
    const timer = setInterval(() => void sync(), this.interval);
    window.addEventListener('online', this.refreshNow);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('online', this.refreshNow);
      this.refreshNow = () => {};
    };
  }
}
