/* @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useUnreadIndicator } from './use-unread-indicator';

describe('useUnreadIndicator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps divider dismissing until timeout completes', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useUnreadIndicator({
        unreadAnchorMessageId: 'message-2',
      }),
    );

    act(() => {
      result.current.dismissUnreadDivider();
    });

    expect(result.current.isUnreadDividerDismissing).toBe(true);
    expect(result.current.dismissedUnreadAnchorId).toBeNull();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(result.current.isUnreadDividerDismissing).toBe(false);
    expect(result.current.dismissedUnreadAnchorId).toBe('message-2');
  });
});
