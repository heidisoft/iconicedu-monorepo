import type {
  WhiteboardOperationVM,
  WhiteboardSnapshotVM,
} from '@iconicedu/shared-types';
import type { WhiteboardRepository } from '@iconicedu/web/lib/whiteboard/api';
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';
/** Serial writes, retained failed operations, stable retry IDs, and incremental batches.
 * Optional session storage preserves pending work across refresh without a global scene store.
 */
export class WhiteboardAutosaveQueue {
  private queue: WhiteboardOperationVM[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disposed = false;
  constructor(
    private readonly repository: WhiteboardRepository,
    private readonly onSnapshot: (snapshot: WhiteboardSnapshotVM) => void,
    private readonly onStatus: (status: SaveStatus, message?: string) => void,
    private readonly storage?: { get(): string | null; set(value: string): void },
  ) {
    try {
      const stored = JSON.parse(storage?.get() ?? '[]');
      if (Array.isArray(stored)) this.queue = stored;
    } catch {
      /* Invalid local draft is never sent. */
    }
  }
  pending() {
    return [...this.queue];
  }
  enqueue(op: WhiteboardOperationVM) {
    const last = this.queue[this.queue.length - 1];
    if (
      !this.running &&
      last?.type === 'elements' &&
      op.type === 'elements' &&
      last.pageId === op.pageId
    ) {
      const map = new Map(last.elements.map((e) => [e.id, e]));
      for (const e of op.elements) map.set(e.id, e);
      last.elements = [...map.values()];
    } else this.queue.push(op);
    this.persist();
    this.onStatus('saving');
    this.schedule(400);
  }
  private persist() {
    try {
      this.storage?.set(JSON.stringify(this.queue));
    } catch {
      this.onStatus(
        'error',
        'Local recovery storage is unavailable. Keep this tab open until saved.',
      );
    }
  }
  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    if (!this.disposed) this.timer = setTimeout(() => void this.flush(), delay);
  }
  async flush() {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (this.queue.length && !this.disposed) {
        const op = this.queue[0];
        const snapshot = await this.repository.save(op);
        this.queue.shift();
        this.persist();
        if (!this.disposed) this.onSnapshot(snapshot);
      }
      if (!this.disposed) this.onStatus('saved');
    } catch (error) {
      if (!this.disposed) {
        this.onStatus(
          'offline',
          error instanceof Error ? error.message : 'Save failed. Retrying…',
        );
        this.schedule(2000);
      }
    } finally {
      this.running = false;
    }
  }
  discard() {
    if (this.running) return false;
    this.queue = [];
    this.persist();
    this.onStatus('saved');
    return true;
  }
  recovery() {
    return JSON.stringify({ schemaVersion: 1, operations: this.queue });
  }
  retry() {
    this.schedule(0);
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
