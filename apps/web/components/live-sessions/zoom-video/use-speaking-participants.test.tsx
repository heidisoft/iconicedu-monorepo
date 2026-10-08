import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { useSpeakingParticipants } from './use-speaking-participants';
it('tracks simultaneous speakers and local levels, clears silence, respects mute and disconnects', () => {
  vi.useFakeTimers();
  try {
    const events = new Map<string, (value: unknown) => void>();
    const on = vi.fn((name, callback) => events.set(name, callback));
    const off = vi.fn();
    const client = { on, off } as unknown as ZoomClient;
    const { result, rerender, unmount } = renderHook(
      ({ connected, muted }) => useSpeakingParticipants(client, connected, 1, muted),
      { initialProps: { connected: true, muted: false } },
    );
    act(() => events.get('active-speaker')?.([{ userId: 2 }, { userId: 3 }]));
    expect([...result.current]).toEqual([2, 3]);
    act(() => events.get('current-audio-level-change')?.({ level: 4 }));
    expect(result.current.has(1)).toBe(true);
    rerender({ connected: true, muted: true });
    expect(result.current.has(1)).toBe(false);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.size).toBe(0);
    act(() => events.get('active-speaker')?.([{ userId: 2 }]));
    rerender({ connected: false, muted: false });
    expect(result.current.size).toBe(0);
    unmount();
    expect(off).toHaveBeenCalledWith('active-speaker', expect.any(Function));
    expect(off).toHaveBeenCalledWith('current-audio-level-change', expect.any(Function));
  } finally {
    vi.useRealTimers();
  }
});
