import { describe, expect, it, vi } from 'vitest';

import {
  bindDirectMessageRecoveryTriggers,
  DM_RECOVERY_SYNC_INTERVAL_MS,
  handleDirectMessageSubscribeStatus,
  shouldSyncOnVisibility,
} from '@iconicedu/web/lib/sidebar/direct-message-recovery';

describe('direct message recovery', () => {
  it('uses a 60s fallback interval by default', () => {
    expect(DM_RECOVERY_SYNC_INTERVAL_MS).toBe(60_000);
  });

  it('syncs only when the tab becomes visible', () => {
    expect(shouldSyncOnVisibility('visible')).toBe(true);
    expect(shouldSyncOnVisibility('hidden')).toBe(false);
  });

  it('syncs on subscribed status only', () => {
    const sync = vi.fn();
    handleDirectMessageSubscribeStatus('SUBSCRIBED', sync);
    handleDirectMessageSubscribeStatus('CHANNEL_ERROR', sync);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('binds focus, visibility, and interval recovery triggers', () => {
    vi.useFakeTimers();
    const sync = vi.fn();
    const originalVisibility = document.visibilityState;

    const cleanup = bindDirectMessageRecoveryTriggers({
      syncDirectMessageMemberships: sync,
      intervalMs: 1_000,
    });

    window.dispatchEvent(new Event('focus'));
    expect(sync).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sync).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sync).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1_000);
    expect(sync).toHaveBeenCalledTimes(3);

    cleanup();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(1_000);
    expect(sync).toHaveBeenCalledTimes(3);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: originalVisibility,
    });
    vi.useRealTimers();
  });
});
