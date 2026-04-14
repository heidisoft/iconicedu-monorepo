import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePushToggle } from '@/hooks/use-push-toggle';

// ─── Mock: expo-notifications ────────────────────────────────────────────────
const mockGetPermissionsAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
}));

// ─── Mock: push-token module ─────────────────────────────────────────────────
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

// ─── Mock: React Query hooks ──────────────────────────────────────────────────
const mockUseNotificationPrefs = jest.fn();
jest.mock('@/hooks/use-notification-prefs', () => ({
  useNotificationPrefs: () => mockUseNotificationPrefs(),
}));

const mockMutateAsync = jest.fn();
const mockUseUpdateNotificationPref = jest.fn();
jest.mock('@/hooks/use-update-notification-pref', () => ({
  useUpdateNotificationPref: () => mockUseUpdateNotificationPref(),
}));

// ─── Mock: account / profile ──────────────────────────────────────────────────
jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({ data: { org_id: 'org-1' } }),
}));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { id: 'profile-1' } }),
}));

// ─── Mock: error reporting ────────────────────────────────────────────────────
const mockReportError = jest.fn();
jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: (...args: unknown[]) => mockReportError(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupPrefs(muted: boolean) {
  mockUseNotificationPrefs.mockReturnValue({
    data: [{ pref_key: '__push__', muted }],
  });
}

function setupMutation() {
  mockMutateAsync.mockResolvedValue(undefined);
  mockUseUpdateNotificationPref.mockReturnValue({ mutateAsync: mockMutateAsync });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupMutation();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePushToggle — initial state', () => {
  it('isPushEnabled is true when OS grants permission and __push__ is not muted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(false);

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));
    expect(result.current.isOsPermissionDenied).toBe(false);
    expect(result.current.isToggling).toBe(false);
  });

  it('isPushEnabled is false when OS grants permission but __push__ is muted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(true);

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));
  });

  it('isPushEnabled is false when OS permission is denied even if pref is not muted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    setupPrefs(false);

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(true));
    expect(result.current.isPushEnabled).toBe(false);
  });

  it('isPushEnabled is false before OS permission check resolves (null state)', () => {
    mockGetPermissionsAsync.mockReturnValue(new Promise(() => undefined)); // never resolves
    setupPrefs(false);

    const { result } = renderHook(() => usePushToggle());

    expect(result.current.isPushEnabled).toBe(false);
    expect(result.current.isOsPermissionDenied).toBe(false);
  });

  it('isOsPermissionDenied is false when permission is undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    setupPrefs(false);

    const { result } = renderHook(() => usePushToggle());

    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(false));
  });
});

describe('usePushToggle — toggle() turning OFF', () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(false); // push is currently enabled
    mockGetStoredPushToken.mockResolvedValue('ExponentPushToken[abc123]');
    mockRevokePushToken.mockResolvedValue(undefined);
  });

  it('calls getStoredPushToken, revokePushToken, then updatePref(muted: true)', async () => {
    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetStoredPushToken).toHaveBeenCalled();
    expect(mockRevokePushToken).toHaveBeenCalledWith('ExponentPushToken[abc123]');
    expect(mockMutateAsync).toHaveBeenCalledWith({ prefKey: '__push__', muted: true });
  });

  it('skips revokePushToken when no stored token but still updates pref', async () => {
    mockGetStoredPushToken.mockResolvedValue(null);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockRevokePushToken).not.toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith({ prefKey: '__push__', muted: true });
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
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(true); // push is currently muted/disabled
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[xyz789]');
    mockStorePushToken.mockResolvedValue(undefined);
  });

  it('calls getExpoPushToken with requestPermissions: false, storePushToken, then updatePref(muted: false)', async () => {
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
    expect(mockMutateAsync).toHaveBeenCalledWith({ prefKey: '__push__', muted: false });
  });

  it('skips storePushToken when getExpoPushToken returns null (simulator/Expo Go) but still updates pref', async () => {
    mockGetExpoPushToken.mockResolvedValue(null);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockStorePushToken).not.toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith({ prefKey: '__push__', muted: false });
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
    setupPrefs(false);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isOsPermissionDenied).toBe(true));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockGetStoredPushToken).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('toggle() is a no-op when isToggling is already true (rapid double-tap)', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(false);
    // Make the first call hang so isToggling stays true
    let resolveFirst!: () => void;
    mockGetStoredPushToken.mockReturnValue(
      new Promise<null>((resolve) => {
        resolveFirst = () => resolve(null);
      }),
    );
    mockRevokePushToken.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePushToggle());
    await waitFor(() => expect(result.current.isPushEnabled).toBe(true));

    // Start first toggle (will hang at getStoredPushToken)
    let firstToggleDone = false;
    act(() => {
      void result.current.toggle().then(() => {
        firstToggleDone = true;
      });
    });

    // While first is in flight, call toggle again — should be no-op
    await act(async () => {
      await result.current.toggle();
    });

    // Only one call to getStoredPushToken (the second toggle was a no-op)
    expect(mockGetStoredPushToken).toHaveBeenCalledTimes(1);

    // Resolve the first toggle
    resolveFirst();
    await waitFor(() => expect(firstToggleDone).toBe(true));
  });

  it('calls reportMobileObservedError and resets isToggling when revokePushToken throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(false);
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

  it('calls reportMobileObservedError and resets isToggling when updatePref throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setupPrefs(true); // turning ON
    mockGetExpoPushToken.mockResolvedValue(null);
    mockMutateAsync.mockRejectedValue(new Error('db error'));

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
});
