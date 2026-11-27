import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMobileFeatureFlag } from './use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import type { MobileFeatureFlagClient } from '@/providers/mobile-feature-flags-provider';
let mockClient: MobileFeatureFlagClient | null = null;
jest.mock('@/providers/mobile-feature-flags-provider', () => ({
  useMobileFeatureFlagClient: () => mockClient,
}));
const key = mobileFeatureFlagKeys.enableParentReferrals;
beforeEach(() => {
  mockClient = null;
});
it('keeps referrals off if no flag client is available', () => {
  const { result } = renderHook(() => useMobileFeatureFlag(key));
  expect(result.current).toBe(false);
});
it('awaits the asynchronous flag refresh rather than the fire-and-forget method', async () => {
  const refresh = jest.fn(async () => {});
  const legacy = jest.fn();
  mockClient = {
    reloadFeatureFlagsAsync: refresh,
    reloadFeatureFlags: legacy,
    isFeatureEnabled: () => true,
  };
  const { result } = renderHook(() => useMobileFeatureFlag(key));
  await waitFor(() => expect(result.current).toBe(true));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(legacy).not.toHaveBeenCalled();
});
it('responds to refreshed flags and removes its subscription on unmount', async () => {
  let listener!: (flags: Record<string, unknown> | undefined) => void;
  const unsubscribe = jest.fn();
  mockClient = {
    isFeatureEnabled: () => true,
    onFeatureFlags: (callback) => {
      listener = callback;
      return unsubscribe;
    },
  };
  const { result, unmount } = renderHook(() => useMobileFeatureFlag(key));
  await waitFor(() => expect(result.current).toBe(true));
  act(() => listener({ [key]: false }));
  expect(result.current).toBe(false);
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
it('does not overwrite a refreshed disabled value with an older asynchronous result', async () => {
  let listener!: (flags: Record<string, unknown> | undefined) => void;
  let resolve!: (value: boolean) => void;
  const read = jest.fn(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  mockClient = {
    isFeatureEnabled: read,
    onFeatureFlags: (callback) => {
      listener = callback;
      return jest.fn();
    },
  };
  const { result } = renderHook(() => useMobileFeatureFlag(key));
  await waitFor(() => expect(read).toHaveBeenCalled());
  act(() => listener({ [key]: false }));
  await act(async () => resolve(true));
  expect(result.current).toBe(false);
});
it('keeps referrals disabled after a refresh failure', async () => {
  mockClient = {
    reloadFeatureFlagsAsync: jest.fn().mockRejectedValue(new Error('offline')),
    isFeatureEnabled: () => true,
  };
  const { result } = renderHook(() => useMobileFeatureFlag(key));
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current).toBe(false);
});
