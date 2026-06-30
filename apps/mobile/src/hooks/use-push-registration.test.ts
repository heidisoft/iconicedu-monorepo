import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePushRegistration } from './use-push-registration';

const mockGetExpoPushToken = jest.fn();
const mockHasPushConsentAccepted = jest.fn();
const mockIsAndroidPushPermissionAutoGranted = jest.fn();
const mockMarkPushConsentAccepted = jest.fn();
const mockMigrateLegacyPushConsentState = jest.fn();
const mockShouldShowPushConsentPrompt = jest.fn();
const mockSnoozePushConsentPrompt = jest.fn();
const mockStorePushToken = jest.fn();
const mockSupportsNativePushNotifications = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockSecureStoreGetItem = jest.fn();
const mockSecureStoreSetItem = jest.fn();

jest.mock('@/lib/notifications/push-token', () => ({
  getExpoPushToken: (...args: unknown[]) => mockGetExpoPushToken(...args),
  hasPushConsentAccepted: (...args: unknown[]) => mockHasPushConsentAccepted(...args),
  isAndroidPushPermissionAutoGranted: (...args: unknown[]) =>
    mockIsAndroidPushPermissionAutoGranted(...args),
  markPushConsentAccepted: (...args: unknown[]) => mockMarkPushConsentAccepted(...args),
  migrateLegacyPushConsentState: (...args: unknown[]) =>
    mockMigrateLegacyPushConsentState(...args),
  shouldShowPushConsentPrompt: (...args: unknown[]) =>
    mockShouldShowPushConsentPrompt(...args),
  snoozePushConsentPrompt: (...args: unknown[]) => mockSnoozePushConsentPrompt(...args),
  storePushToken: (...args: unknown[]) => mockStorePushToken(...args),
  supportsNativePushNotifications: (...args: unknown[]) =>
    mockSupportsNativePushNotifications(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) =>
    mockSetNotificationChannelAsync(...args),
  AndroidImportance: { MAX: 4 },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockSecureStoreGetItem(...args),
  setItemAsync: (...args: unknown[]) => mockSecureStoreSetItem(...args),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    isDevice: true,
    executionEnvironment: 'bareExpo',
    expoConfig: null,
    easConfig: null,
  },
}));

const mockAccountData: Record<string, unknown> = { id: 'acc-1', org_id: 'org-1' };
const mockProfileData: Record<string, unknown> = { id: 'profile-1' };

jest.mock('./use-account', () => ({
  useAccount: () => ({ data: mockAccountData }),
}));

jest.mock('./use-profile', () => ({
  useProfile: () => ({ data: mockProfileData }),
}));

const mockConstants = jest.requireMock('expo-constants').default as {
  isDevice: boolean | undefined;
  executionEnvironment: string;
};

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.isDevice = true;
    mockConstants.executionEnvironment = 'bareExpo';
    mockSupportsNativePushNotifications.mockReturnValue(true);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockSetNotificationChannelAsync.mockResolvedValue(undefined);
    mockHasPushConsentAccepted.mockResolvedValue(true);
    mockIsAndroidPushPermissionAutoGranted.mockReturnValue(false);
    mockMarkPushConsentAccepted.mockResolvedValue(undefined);
    mockMigrateLegacyPushConsentState.mockResolvedValue(undefined);
    mockShouldShowPushConsentPrompt.mockResolvedValue(false);
    mockSnoozePushConsentPrompt.mockResolvedValue(undefined);
    mockStorePushToken.mockResolvedValue(undefined);
    mockSecureStoreGetItem.mockResolvedValue('1');
    mockSecureStoreSetItem.mockResolvedValue(undefined);
  });

  it('registers and stores token when account and profile are available', async () => {
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
    expect(mockMigrateLegacyPushConsentState).toHaveBeenCalledWith('granted');
    await waitFor(() => {
      expect(mockStorePushToken).toHaveBeenCalledWith(
        'org-1',
        'profile-1',
        'ExponentPushToken[test]',
      );
    });
  });

  it('skips storePushToken when getExpoPushToken returns null', async () => {
    mockGetExpoPushToken.mockResolvedValue(null);

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('does not throw when getExpoPushToken rejects', async () => {
    mockGetExpoPushToken.mockRejectedValue(new Error('permission error'));

    expect(() => renderHook(() => usePushRegistration())).not.toThrow();
    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
  });

  it('only registers once even if re-rendered', async () => {
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');

    const { rerender } = renderHook(() => usePushRegistration());
    rerender({});
    rerender({});

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalledTimes(1);
    });
  });

  it('does not show the consent sheet automatically when notifications are still undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockShouldShowPushConsentPrompt.mockResolvedValue(true);

    const { result } = renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
    });
    expect(result.current.showConsent).toBe(false);
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('does not silently register on Android versions where push permission is auto-granted without in-app consent', async () => {
    mockIsAndroidPushPermissionAutoGranted.mockReturnValue(true);
    mockHasPushConsentAccepted.mockResolvedValue(false);

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockHasPushConsentAccepted).toHaveBeenCalled();
    });
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('shows the consent sheet when contextual consent is requested', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockShouldShowPushConsentPrompt.mockResolvedValue(true);

    const { result } = renderHook(() => usePushRegistration());

    let showedConsent = false;
    await act(async () => {
      showedConsent = await result.current.requestConsent();
    });

    expect(showedConsent).toBe(true);
    expect(result.current.showConsent).toBe(true);
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('shows contextual consent on Android versions where push permission is auto-granted but in-app consent is missing', async () => {
    mockIsAndroidPushPermissionAutoGranted.mockReturnValue(true);
    mockHasPushConsentAccepted.mockResolvedValue(false);
    mockShouldShowPushConsentPrompt.mockResolvedValue(true);

    const { result } = renderHook(() => usePushRegistration());

    let showedConsent = false;
    await act(async () => {
      showedConsent = await result.current.requestConsent();
    });

    expect(showedConsent).toBe(true);
    expect(result.current.showConsent).toBe(true);
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('snoozes contextual consent when dismissed', async () => {
    const { result } = renderHook(() => usePushRegistration());

    await act(async () => {
      await result.current.onConsentDismissed();
    });

    expect(mockSnoozePushConsentPrompt).toHaveBeenCalledTimes(1);
    expect(mockMarkPushConsentAccepted).not.toHaveBeenCalled();
  });

  it('marks contextual consent accepted when enabled', async () => {
    mockGetExpoPushToken.mockResolvedValue(null);
    const { result } = renderHook(() => usePushRegistration());

    await act(async () => {
      await result.current.onConsentGranted();
    });

    expect(mockMarkPushConsentAccepted).toHaveBeenCalledTimes(1);
    expect(mockSnoozePushConsentPrompt).not.toHaveBeenCalled();
  });

  it('does not show the consent sheet when notifications are already granted', async () => {
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');
    mockSecureStoreGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
    expect(result.current.showConsent).toBe(false);
  });

  it('does not prompt on unsupported devices', async () => {
    mockSupportsNativePushNotifications.mockReturnValue(false);

    const { result } = renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    });
    expect(result.current.showConsent).toBe(false);
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockStorePushToken).not.toHaveBeenCalled();
  });

  it('continues registration when native push support is available', async () => {
    mockConstants.isDevice = undefined;
    mockConstants.executionEnvironment = 'bare';
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
    expect(mockStorePushToken).toHaveBeenCalledWith(
      'org-1',
      'profile-1',
      'ExponentPushToken[test]',
    );
  });
});
