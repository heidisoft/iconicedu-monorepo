import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePushToggle } from '@/hooks/use-push-toggle';

const mockGetPermissionsAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
}));

const mockGetExpoPushToken = jest.fn();
const mockStorePushToken = jest.fn();
const mockRevokePushToken = jest.fn();
const mockGetStoredPushToken = jest.fn();

jest.mock('@/lib/notifications/push-token', () => ({
  getExpoPushToken: (...args: unknown[]) => mockGetExpoPushToken(...args),
  storePushToken: (...args: unknown[]) => mockStorePushToken(...args),
  revokePushToken: (...args: unknown[]) => mockRevokePushToken(...args),
  getStoredPushToken: (...args: unknown[]) => mockGetStoredPushToken(...args),
}));

jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({ data: { org_id: 'org-1' } }),
}));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { id: 'profile-1' } }),
}));

const mockReportError = jest.fn();
jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: (...args: unknown[]) => mockReportError(...args),
}));

let appStateChangeListener: ((state: AppStateStatus) => void) | null = null;
let removeSpy: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  appStateChangeListener = null;
  removeSpy = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event: string, listener: (state: AppStateStatus) => void) => {
      appStateChangeListener = listener;
      return { remove: removeSpy };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('usePushToggle — initial state', () => {
  it('isPushEnabled is true when OS grants permission', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));
    expect(result.current.isOsPermissionDenied).toBe(false);
    expect(result.current.isToggling).toBe(false);
  });

  it('isPushEnabled is false when OS permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(true));
    expect(result.current.isPushEnabled).toBe(false);
  });

  it('isPushEnabled is false before OS permission check resolves', () => {
    mockGetPermissionsAsync.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePushToggle());

    expect(result.current.isPushEnabled).toBe(false);
    expect(result.current.isOsPermissionDenied).toBe(false);
  });

  it('refreshes permission when the app returns to active state', async () => {
    mockGetPermissionsAsync
      .mockResolvedValueOnce({ status: 'denied' })
      .mockResolvedValueOnce({ status: 'granted' });

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(true));

    await act(async () => {
      appStateChangeListener?.('active');
    });

    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));
  });
});

describe('usePushToggle — toggle() turning OFF', () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetStoredPushToken.mockResolvedValue('ExponentPushToken[abc123]');
    mockRevokePushToken.mockResolvedValue(undefined);
  });

  it('calls getStoredPushToken and revokePushToken', async () => {
    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetStoredPushToken).toHaveBeenCalled();
    expect(mockRevokePushToken).toHaveBeenCalledWith('ExponentPushToken[abc123]');
  });

  it('skips revokePushToken when no stored token exists', async () => {
    mockGetStoredPushToken.mockResolvedValue(null);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockRevokePushToken).not.toHaveBeenCalled();
  });

  it('resets isToggling to false after completion', async () => {
    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.isToggling).toBe(false);
  });
});

describe('usePushToggle — toggle() turning ON', () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[xyz789]');
    mockStorePushToken.mockResolvedValue(undefined);
  });

  it('calls getExpoPushToken with requestPermissions: false and stores the token', async () => {
    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ requestPermissions: false });
    expect(mockStorePushToken).toHaveBeenCalledWith(
      'org-1',
      'profile-1',
      'ExponentPushToken[xyz789]',
    );
  });

  it('skips storePushToken when getExpoPushToken returns null', async () => {
    mockGetExpoPushToken.mockResolvedValue(null);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('resets isToggling to false after completion', async () => {
    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.isToggling).toBe(false);
  });
});

describe('usePushToggle — edge cases', () => {
  it('toggle() is a no-op when isOsPermissionDenied is true', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetStoredPushToken).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it('toggle() is a no-op when isToggling is already true', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    let resolveFirst!: () => void;
    mockGetStoredPushToken.mockReturnValue(
      new Promise<null>((resolve) => {
        resolveFirst = () => resolve(null);
      }),
    );

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    let firstToggleDone = false;
    act(() => {
      void result.current.toggle().then(() => {
        firstToggleDone = true;
      });
    });

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetStoredPushToken).toHaveBeenCalledTimes(1);

    resolveFirst();
    await waitFor(() => expect(firstToggleDone).toBe(true));
  });

  it('reports an error when revokePushToken throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetStoredPushToken.mockResolvedValue('ExponentPushToken[abc123]');
    mockRevokePushToken.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'mobile.notifications.use_push_toggle',
        message: 'Failed to disable push notifications',
      }),
    );
    expect(result.current.isToggling).toBe(false);
  });

  it('reports an error when token registration throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockGetExpoPushToken.mockRejectedValue(new Error('token error'));

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'mobile.notifications.use_push_toggle',
        message: 'Failed to enable push notifications',
      }),
    );
    expect(result.current.isToggling).toBe(false);
  });

  it('removes the AppState listener on unmount', () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const { unmount } = renderHook(() => usePushToggle());

    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });
});
