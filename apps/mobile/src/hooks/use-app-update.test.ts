import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAppUpdate } from './use-app-update';

const mockCheckForUpdateAsync = jest.fn();
const mockFetchUpdateAsync = jest.fn();
const mockReloadAsync = jest.fn();
let mockIsUpdatePending = false;
let mockIsEnabled = true;

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockIsEnabled;
  },
  useUpdates: () => ({ isUpdatePending: mockIsUpdatePending }),
  checkForUpdateAsync: (...args: unknown[]) => mockCheckForUpdateAsync(...args),
  fetchUpdateAsync: (...args: unknown[]) => mockFetchUpdateAsync(...args),
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
}));

const setDev = (value: boolean) => {
  Object.defineProperty(global, '__DEV__', { value, writable: true, configurable: true });
};

describe('useAppUpdate', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    setDev(false);
    mockIsEnabled = true;
    mockIsUpdatePending = false;
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false });
    mockFetchUpdateAsync.mockResolvedValue({ isNew: true });
    mockReloadAsync.mockResolvedValue(undefined);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setDev(true);
  });

  it('downloads silently and never prompts or restarts when an update becomes pending', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    const { rerender } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1));
    mockIsUpdatePending = true;
    rerender({});
    mockIsUpdatePending = false;
    rerender({});
    mockIsUpdatePending = true;
    rerender({});
    expect(alert).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('does not prompt or restart for an update downloaded by the native launch check', async () => {
    mockIsUpdatePending = true;
    renderHook(() => useAppUpdate());
    await act(async () => {});
    expect(alert).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('does not download or prompt when no update is available', async () => {
    renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1));
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it.each(['check', 'download'])(
    'keeps the session running after a %s failure',
    async (stage) => {
      mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
      if (stage === 'check')
        mockCheckForUpdateAsync.mockRejectedValue(new Error('offline'));
      else mockFetchUpdateAsync.mockRejectedValue(new Error('offline'));
      renderHook(() => useAppUpdate());
      await act(async () => {});
      expect(mockReloadAsync).not.toHaveBeenCalled();
      expect(alert).not.toHaveBeenCalled();
    },
  );

  it.each(['development', 'disabled'])('skips updates when %s', (mode) => {
    setDev(mode === 'development');
    mockIsEnabled = mode !== 'disabled';
    mockIsUpdatePending = true;
    renderHook(() => useAppUpdate());
    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('checks only once across rerenders', async () => {
    const { rerender } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1));
    rerender({});
    rerender({});
    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not start a download after unmount', async () => {
    let resolveCheck!: (value: { isAvailable: boolean }) => void;
    mockCheckForUpdateAsync.mockReturnValue(
      new Promise((resolve) => (resolveCheck = resolve)),
    );
    const { unmount } = renderHook(() => useAppUpdate());
    unmount();
    await act(async () => resolveCheck({ isAvailable: true }));
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
});
