import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpWhiteboardCollaborationProvider } from './provider';
const snapshot = {
  id: 'board',
  revision: 1,
  role: 'teacher' as const,
  presence: [],
  document: {
    schemaVersion: 1 as const,
    studentEditing: true,
    pages: [{ id: 'one', title: 'Page 1', elements: [] }],
  },
};
afterEach(() => vi.useRealTimers());
describe('collaboration transport', () => {
  it('recovers authoritative state after a disconnect and cleans up subscriptions', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(snapshot);
    const status = vi.fn(),
      receive = vi.fn();
    const provider = new HttpWhiteboardCollaborationProvider(
      { load, save: vi.fn() },
      100,
    );
    const disconnect = provider.connect(receive, status);
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(100);
    expect(receive).toHaveBeenCalledWith(snapshot);
    expect(status).toHaveBeenCalledWith('connected');
    disconnect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent refresh requests and ignores late responses after disconnect', async () => {
    let resolve: (value: typeof snapshot) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<typeof snapshot>((r) => {
          resolve = r;
        }),
    );
    const receive = vi.fn();
    const provider = new HttpWhiteboardCollaborationProvider({ load, save: vi.fn() });
    const disconnect = provider.connect(receive, vi.fn());
    provider.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    disconnect();
    resolve(snapshot);
    await Promise.resolve();
    expect(receive).not.toHaveBeenCalled();
  });
});
