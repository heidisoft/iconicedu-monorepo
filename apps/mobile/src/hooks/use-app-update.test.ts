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

  it('downloads without restarting and prompts only when the download is pending', async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    const { rerender } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1));
    expect(alert).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();

    mockIsUpdatePending = true;
    rerender({});
    expect(alert).toHaveBeenCalledWith('Update ready', expect.any(String), [
      { text: 'Later', style: 'cancel' },
      { text: 'Restart now', onPress: expect.any(Function) },
    ]);
    expect(mockReloadAsync).not.toHaveBeenCalled();
    rerender({});
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('prompts for a download from the native launch check and restarts on request', async () => {
    mockIsUpdatePending = true;
    renderHook(() => useAppUpdate());
    const restart = alert.mock.calls[0][2][1].onPress;
    await act(async () => restart());
    expect(mockReloadAsync).toHaveBeenCalledTimes(1);
  });

  it('lets the user defer without reloading or prompting again', () => {
    mockIsUpdatePending = true;
    const { rerender } = renderHook(() => useAppUpdate());
    expect(alert.mock.calls[0][2][0]).toEqual({ text: 'Later', style: 'cancel' });
    mockIsUpdatePending = false;
    rerender({});
    mockIsUpdatePending = true;
    rerender({});
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  it('explains how to apply the update if restarting fails', async () => {
    mockIsUpdatePending = true;
    mockReloadAsync.mockRejectedValue(new Error('reload failed'));
    renderHook(() => useAppUpdate());
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(alert).toHaveBeenLastCalledWith('Could not restart', expect.any(String));
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
