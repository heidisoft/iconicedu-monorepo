import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeetingWaitingRoom } from './meeting-waiting-room';
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createPublicApiClient: () => ({ post: mocks.post }),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe('waiting room foreground recovery', () => {
  it('refreshes immediately on network/foreground return and cleans up after leaving', async () => {
    vi.useFakeTimers();
    mocks.post
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { id: 'request', displayName: 'Student', createdAt: '2026-10-12T00:00:00Z' },
      ]);
    const view = render(<MeetingWaitingRoom sessionId="session" linkToken="link" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Admit Student' })).toBeVisible();
    view.unmount();
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });
});
