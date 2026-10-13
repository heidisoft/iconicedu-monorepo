import { afterEach, describe, it, expect, vi } from 'vitest';
import { WhiteboardAutosaveQueue } from './autosave-queue';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
const snapshot: WhiteboardSnapshotVM = {
  id: 'board',
  revision: 1,
  role: 'teacher',
  presence: [],
  document: {
    schemaVersion: 1,
    studentEditing: true,
    pages: [{ id: 'page', title: 'Page 1', elements: [] }],
  },
};
afterEach(() => vi.useRealTimers());
describe('whiteboard autosave', () => {
  it('debounces saves and preserves failed work with the same id for retry', async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(snapshot);
    const status = vi.fn();
    const receive = vi.fn();
    let stored = '[]';
    const queue = new WhiteboardAutosaveQueue(
      { load: async () => snapshot, save },
      receive,
      status,
      {
        get: () => stored,
        set: (v) => {
          stored = v;
        },
      },
    );
    const op = { id: 'op', type: 'student-editing' as const, enabled: false };
    queue.enqueue(op);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(queue.pending()).toEqual([op]);
    expect(JSON.parse(stored)).toEqual([op]);
    expect(status).toHaveBeenCalledWith('offline', 'Offline');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenNthCalledWith(2, op);
    expect(receive).toHaveBeenCalledWith(snapshot);
    expect(queue.pending()).toEqual([]);
    queue.dispose();
  });
  it('serializes in-flight changes and restores pending drafts', async () => {
    let resolve: (value: WhiteboardSnapshotVM) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WhiteboardSnapshotVM>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue(snapshot);
    const op = { id: 'first', type: 'student-editing' as const, enabled: false };
    const q = new WhiteboardAutosaveQueue(
      { load: async () => snapshot, save },
      vi.fn(),
      vi.fn(),
      { get: () => JSON.stringify([op]), set: vi.fn() },
    );
    const flushing = q.flush();
    q.enqueue({ ...op, id: 'second', enabled: true });
    resolve(snapshot);
    await flushing;
    expect(save.mock.calls.map((c) => c[0].id)).toEqual(['first', 'second']);
    q.dispose();
  });
});

it('exports pending recovery data and discards only when no save is in flight', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Offline'));
  let stored = '[]';
  const status = vi.fn();
  const queue = new WhiteboardAutosaveQueue(
    { load: async () => snapshot, save },
    vi.fn(),
    status,
    {
      get: () => stored,
      set: (value) => {
        stored = value;
      },
    },
  );
  queue.enqueue({ id: 'op', type: 'clear-page', pageId: 'page' });
  await queue.flush();
  expect(JSON.parse(queue.recovery()).operations).toHaveLength(1);
  expect(queue.discard()).toBe(true);
  expect(queue.pending()).toEqual([]);
  expect(stored).toBe('[]');
  queue.dispose();
});
