import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSpeakingHold } from './use-speaking-hold';

it('bridges brief pauses, renews on speech and clears immediately when muted', () => {
  vi.useFakeTimers();
  try {
    const { result, rerender, unmount } = renderHook(
      ({ speaking, enabled }) => useSpeakingHold(speaking, enabled),
      { initialProps: { speaking: true, enabled: true } },
    );
    rerender({ speaking: false, enabled: true });
    act(() => vi.advanceTimersByTime(1700));
    expect(result.current).toBe(true);
    rerender({ speaking: true, enabled: true });
    rerender({ speaking: false, enabled: true });
    act(() => vi.advanceTimersByTime(1799));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
    rerender({ speaking: true, enabled: true });
    rerender({ speaking: true, enabled: false });
    expect(result.current).toBe(false);
    rerender({ speaking: false, enabled: true });
    expect(result.current).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
