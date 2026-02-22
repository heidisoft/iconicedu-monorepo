import { describe, expect, it, vi } from 'vitest';

import { shouldSkipCallbackRun } from '@iconicedu/web/app/(auth)/auth/callback/callback-run-guard';

describe('shouldSkipCallbackRun', () => {
  it('allows first run and stores timestamp', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };

    const skip = shouldSkipCallbackRun(storage, 'callback:key', 1_000, 15_000);

    expect(skip).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith('callback:key', '1000');
  });

  it('skips repeated runs within ttl', () => {
    const storage = {
      getItem: vi.fn(() => '1000'),
      setItem: vi.fn(),
    };

    const skip = shouldSkipCallbackRun(storage, 'callback:key', 2_000, 15_000);

    expect(skip).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('allows rerun after ttl has elapsed', () => {
    const storage = {
      getItem: vi.fn(() => '1000'),
      setItem: vi.fn(),
    };

    const skip = shouldSkipCallbackRun(storage, 'callback:key', 20_100, 15_000);

    expect(skip).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith('callback:key', '20100');
  });
});
