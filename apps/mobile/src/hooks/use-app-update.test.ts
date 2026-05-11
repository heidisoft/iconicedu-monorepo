import { renderHook, waitFor } from '@testing-library/react-native';

const mockCheckForUpdateAsync = jest.fn();
const mockFetchUpdateAsync = jest.fn();
const mockReloadAsync = jest.fn();

jest.mock('expo-updates', () => ({
  checkForUpdateAsync: (...args: unknown[]) => mockCheckForUpdateAsync(...args),
  fetchUpdateAsync: (...args: unknown[]) => mockFetchUpdateAsync(...args),
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
}));

// __DEV__ is true by default in the jest/react-native environment.
// Tests that exercise the non-dev path flip it to false before rendering.
const setDev = (value: boolean) => {
  Object.defineProperty(global, '__DEV__', { value, writable: true, configurable: true });
};

const { useAppUpdate } = require('./use-app-update');

describe('useAppUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDev(false); // default to production-like env for most tests
  });

  afterAll(() => {
    setDev(true); // restore for any tests that run after this suite
  });

  it('fetches and reloads when an update is available', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockResolvedValue(undefined);
    mockReloadAsync.mockResolvedValue(undefined);

    renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('does not fetch or reload when no update is available', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false });

    renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('silently swallows errors during the update check', async () => {
    mockCheckForUpdateAsync.mockRejectedValue(new Error('network error'));

    // Should not throw
    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(result.error).toBeUndefined();
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('silently swallows errors during fetch', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(result.error).toBeUndefined();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('skips the update check in dev mode (__DEV__ === true)', async () => {
    setDev(true);

    renderHook(() => useAppUpdate());

    // Give the effect time to (not) fire
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();
  });

  it('only runs the check once even when the component re-renders', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false });

    const { rerender } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    rerender({});
    rerender({});

    // Still only one call
    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
  });
});
