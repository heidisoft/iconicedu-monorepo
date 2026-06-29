import { act, renderHook } from '@testing-library/react-native';

import { usePushNudge } from './use-push-nudge';

const mockGetExpoPushToken = jest.fn();
const mockIsAndroidPushPermissionAutoGranted = jest.fn();
const mockMarkPushConsentAccepted = jest.fn();
const mockStorePushToken = jest.fn();
const mockSupportsNativePushNotifications = jest.fn();
const mockOpenNotificationSettings = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockSecureStoreGetItemAsync = jest.fn();
const mockSecureStoreSetItemAsync = jest.fn();
const mockApiGet = jest.fn();
const mockApiPut = jest.fn();

jest.mock('@/lib/notifications/push-token', () => ({
  getExpoPushToken: (...args: unknown[]) => mockGetExpoPushToken(...args),
  isAndroidPushPermissionAutoGranted: (...args: unknown[]) =>
    mockIsAndroidPushPermissionAutoGranted(...args),
  markPushConsentAccepted: (...args: unknown[]) => mockMarkPushConsentAccepted(...args),
  openNotificationSettings: (...args: unknown[]) => mockOpenNotificationSettings(...args),
  storePushToken: (...args: unknown[]) => mockStorePushToken(...args),
  supportsNativePushNotifications: (...args: unknown[]) =>
    mockSupportsNativePushNotifications(...args),
}));

jest.mock('@/lib/api/http-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockSecureStoreGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSecureStoreSetItemAsync(...args),
}));

jest.mock('./use-account', () => ({
  useAccount: () => ({ data: { org_id: 'org-1' } }),
}));

jest.mock('./use-profile', () => ({
  useProfile: () => ({ data: { id: 'profile-1' } }),
}));

describe('usePushNudge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupportsNativePushNotifications.mockReturnValue(true);
    mockIsAndroidPushPermissionAutoGranted.mockReturnValue(false);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockSecureStoreGetItemAsync.mockResolvedValue(null);
    mockSecureStoreSetItemAsync.mockResolvedValue(undefined);
    mockApiGet.mockResolvedValue([{ muted: false }]);
    mockApiPut.mockResolvedValue({ success: true });
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');
    mockStorePushToken.mockResolvedValue(undefined);
    mockMarkPushConsentAccepted.mockResolvedValue(undefined);
  });

  it('nudges when OS permission is granted but master push is muted in app', async () => {
    mockApiGet.mockResolvedValue([{ muted: true }]);

    const { result } = renderHook(() => usePushNudge());

    await act(async () => {
      await result.current.triggerNudge();
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.nudgeVariant).toBe('enable-in-app');

    await act(async () => {
      await result.current.handleEnable();
    });

    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ requestPermissions: false });
    expect(mockStorePushToken).toHaveBeenCalledWith(
      'org-1',
      'profile-1',
      'ExponentPushToken[test]',
    );
    expect(mockApiPut).toHaveBeenCalledWith('/notification-preferences', {
      orgId: 'org-1',
      profileId: 'profile-1',
      prefKey: '__push__',
      channels: ['push'],
      muted: false,
    });
    expect(mockMarkPushConsentAccepted).toHaveBeenCalledTimes(1);
  });
});
