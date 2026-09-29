import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useMobileAppUpdateRequired } from './use-mobile-app-update-required';
import { useMobileFeatureFlagClient } from '@/providers/mobile-feature-flags-provider';
import { getMobileBuildInfo } from '@/lib/build-info';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/providers/mobile-feature-flags-provider', () => ({
  useMobileFeatureFlagClient: jest.fn(),
}));

jest.mock('@/lib/build-info', () => ({
  getMobileBuildInfo: jest.fn(),
}));

function mockClient(payload: unknown) {
  (useMobileFeatureFlagClient as jest.Mock).mockReturnValue({
    reloadFeatureFlags: jest.fn().mockResolvedValue(undefined),
    getFeatureFlagPayload: jest.fn().mockResolvedValue(payload),
  });
}

describe('useMobileAppUpdateRequired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as unknown as { OS: string }).OS = 'ios';
    (getMobileBuildInfo as jest.Mock).mockReturnValue({ version: '1.0.0' });
  });

  it('does not show when there is no feature flag client', async () => {
    (useMobileFeatureFlagClient as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    expect(result.current.shouldShow).toBe(false);
  });

  it('does not show when the current version already satisfies the minimum', async () => {
    (getMobileBuildInfo as jest.Mock).mockReturnValue({ version: '1.2.0' });
    mockClient({ ios: '1.2.0' });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(useMobileFeatureFlagClient).toHaveBeenCalled();
    });
    expect(result.current.shouldShow).toBe(false);
  });

  it('shows when the current version falls below the platform minimum', async () => {
    (getMobileBuildInfo as jest.Mock).mockReturnValue({ version: '1.0.0' });
    mockClient({ ios: '1.2.0', message: 'Please update!' });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
    expect(result.current.message).toBe('Please update!');
  });

  it('reads the android field when running on android', async () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    (getMobileBuildInfo as jest.Mock).mockReturnValue({ version: '1.0.0' });
    mockClient({ ios: '9.9.9', android: '1.2.0' });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
  });

  it('falls back to the default message when none is configured', async () => {
    mockClient({ ios: '1.2.0' });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
    expect(result.current.message).toMatch(/update/i);
  });

  it('hides for the rest of the session once dismissed', async () => {
    mockClient({ ios: '1.2.0' });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.shouldShow).toBe(false);
  });

  it('tolerates a flag-fetch failure by not showing the banner', async () => {
    (useMobileFeatureFlagClient as jest.Mock).mockReturnValue({
      reloadFeatureFlags: jest.fn().mockRejectedValue(new Error('network')),
      getFeatureFlagPayload: jest.fn(),
    });

    const { result } = renderHook(() => useMobileAppUpdateRequired());

    await waitFor(() => {
      expect(useMobileFeatureFlagClient).toHaveBeenCalled();
    });
    expect(result.current.shouldShow).toBe(false);
  });
});
