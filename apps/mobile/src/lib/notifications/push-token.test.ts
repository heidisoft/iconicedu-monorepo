import {
  PUSH_CONSENT_ACCEPTED_KEY,
  PUSH_CONSENT_LEGACY_SHOWN_KEY,
  PUSH_CONSENT_NEXT_PROMPT_AT_KEY,
  PUSH_TOKEN_STORE_KEY,
  getExpoPushToken,
  getPushConsentSnoozeUntil,
  getStoredPushToken,
  hasPushConsentAccepted,
  isAndroidPushPermissionAutoGranted,
  markPushConsentAccepted,
  migrateLegacyPushConsentState,
  revokePushToken,
  shouldShowPushConsentPrompt,
  snoozePushConsentPrompt,
  storePushToken,
  supportsNativePushNotifications,
} from './push-token';

const mockSecureStoreSetItemAsync = jest.fn();
const mockSecureStoreGetItemAsync = jest.fn();
const mockSecureStoreDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSecureStoreSetItemAsync(...args),
  getItemAsync: (...args: unknown[]) => mockSecureStoreGetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureStoreDeleteItemAsync(...args),
}));

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: null,
    isDevice: true,
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: null,
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 17 },
}));

const mockPlatform = jest.requireMock('react-native').Platform as {
  OS: 'ios' | 'android' | 'web';
  Version: number | string;
};

const mockConstants = jest.requireMock('expo-constants').default as {
  appOwnership: string | null;
  isDevice: boolean | undefined;
  expoConfig: { extra: { eas: { projectId: string } } } | null;
  easConfig: { projectId: string } | null;
};

const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockApiPost = jest.fn();

jest.mock('@/lib/api/http-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

describe('getExpoPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.appOwnership = null;
    mockConstants.isDevice = true;
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[test-token]',
    });
  });

  it('returns token when permissions already granted', async () => {
    const token = await getExpoPushToken();
    expect(token).toBe('ExponentPushToken[test-token]');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permissions when not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const token = await getExpoPushToken();
    expect(token).toBe('ExponentPushToken[test-token]');
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when permissions denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const token = await getExpoPushToken();
    expect(token).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('does not request permissions when requestPermissions is false', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const token = await getExpoPushToken({ requestPermissions: false });

    expect(token).toBeNull();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('continues in bare/dev runtimes when Constants.isDevice is undefined', async () => {
    mockConstants.isDevice = undefined;

    const token = await getExpoPushToken();

    expect(token).toBe('ExponentPushToken[test-token]');
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalled();
  });
});

describe('supportsNativePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = 'ios';
    mockPlatform.Version = 17;
    mockConstants.appOwnership = null;
    mockConstants.isDevice = true;
  });

  it('returns false in Expo Go', () => {
    mockConstants.appOwnership = 'expo';

    expect(supportsNativePushNotifications()).toBe(false);
  });

  it('returns false when explicitly running on a non-device', () => {
    mockConstants.isDevice = false;

    expect(supportsNativePushNotifications()).toBe(false);
  });

  it('returns true when device detection is undefined outside Expo Go', () => {
    mockConstants.isDevice = undefined;

    expect(supportsNativePushNotifications()).toBe(true);
  });
});

describe('isAndroidPushPermissionAutoGranted', () => {
  afterEach(() => {
    mockPlatform.OS = 'ios';
    mockPlatform.Version = 17;
  });

  it('returns true for Android versions before API 33', () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 32;

    expect(isAndroidPushPermissionAutoGranted()).toBe(true);
  });

  it('returns false for Android API 33 and newer', () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 33;

    expect(isAndroidPushPermissionAutoGranted()).toBe(false);
  });

  it('returns false outside Android', () => {
    mockPlatform.OS = 'ios';
    mockPlatform.Version = 17;

    expect(isAndroidPushPermissionAutoGranted()).toBe(false);
  });
});

describe('storePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue({ success: true });
    mockSecureStoreSetItemAsync.mockResolvedValue(undefined);
  });

  it('calls the push token register endpoint with correct fields', async () => {
    await storePushToken('org-1', 'profile-1', 'ExponentPushToken[abc]');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/push-tokens/register',
      expect.objectContaining({
        orgId: 'org-1',
        profileId: 'profile-1',
        token: 'ExponentPushToken[abc]',
        platform: 'ios',
      }),
    );
  });

  it('persists token to SecureStore after successful DB upsert', async () => {
    await storePushToken('org-1', 'profile-1', 'ExponentPushToken[abc]');
    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_TOKEN_STORE_KEY,
      'ExponentPushToken[abc]',
    );
  });

  it('throws when the API request fails and does not call SecureStore', async () => {
    mockApiPost.mockRejectedValue(new Error('DB error'));
    await expect(storePushToken('org-1', 'profile-1', 'token')).rejects.toThrow(
      'DB error',
    );
    expect(mockSecureStoreSetItemAsync).not.toHaveBeenCalled();
  });
});

describe('getStoredPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored token from SecureStore', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValue('ExponentPushToken[stored]');
    const token = await getStoredPushToken();
    expect(token).toBe('ExponentPushToken[stored]');
    expect(mockSecureStoreGetItemAsync).toHaveBeenCalledWith(PUSH_TOKEN_STORE_KEY);
  });

  it('returns null when no token is stored', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValue(null);
    const token = await getStoredPushToken();
    expect(token).toBeNull();
  });
});

describe('push consent prompt cooldown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a next prompt timestamp between 7 and 14 days', () => {
    const now = 1_700_000_000_000;
    const dayMs = 24 * 60 * 60 * 1000;

    expect(getPushConsentSnoozeUntil(now, 0)).toBe(String(now + 7 * dayMs));
    expect(getPushConsentSnoozeUntil(now, 0.999999)).toBe(String(now + 14 * dayMs));
  });

  it('does not show the prompt when accepted', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValueOnce('1');

    await expect(shouldShowPushConsentPrompt()).resolves.toBe(false);
    expect(mockSecureStoreGetItemAsync).toHaveBeenCalledWith(PUSH_CONSENT_ACCEPTED_KEY);
  });

  it('does not show the prompt before the snooze expires', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    mockSecureStoreGetItemAsync.mockResolvedValueOnce(null).mockResolvedValueOnce('2000');

    await expect(shouldShowPushConsentPrompt()).resolves.toBe(false);
  });

  it('shows the prompt after the snooze expires', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(3_000);
    mockSecureStoreGetItemAsync.mockResolvedValueOnce(null).mockResolvedValueOnce('2000');

    await expect(shouldShowPushConsentPrompt()).resolves.toBe(true);
  });

  it('reports whether push consent has been explicitly accepted', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValueOnce('1');

    await expect(hasPushConsentAccepted()).resolves.toBe(true);

    mockSecureStoreGetItemAsync.mockResolvedValueOnce(null);
    await expect(hasPushConsentAccepted()).resolves.toBe(false);
  });

  it('marks accepted by storing the accepted key and clearing snooze', async () => {
    await markPushConsentAccepted();

    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_ACCEPTED_KEY,
      '1',
    );
    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_LEGACY_SHOWN_KEY,
    );
    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_NEXT_PROMPT_AT_KEY,
    );
  });

  it('snoozes by clearing accepted and storing next prompt timestamp', async () => {
    await snoozePushConsentPrompt();

    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_ACCEPTED_KEY,
    );
    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_LEGACY_SHOWN_KEY,
    );
    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_NEXT_PROMPT_AT_KEY,
      expect.any(String),
    );
  });

  it('migrates legacy accepted state when OS permission is granted', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValueOnce('1');

    await migrateLegacyPushConsentState('granted');

    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_ACCEPTED_KEY,
      '1',
    );
    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_LEGACY_SHOWN_KEY,
    );
  });

  it('migrates legacy Not Now state to a snooze when OS permission is undetermined', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValueOnce('1');

    await migrateLegacyPushConsentState('undetermined');

    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_LEGACY_SHOWN_KEY,
    );
    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_NEXT_PROMPT_AT_KEY,
      expect.any(String),
    );
  });

  it('clears legacy state when OS permission is denied', async () => {
    mockSecureStoreGetItemAsync.mockResolvedValueOnce('1');

    await migrateLegacyPushConsentState('denied');

    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(
      PUSH_CONSENT_LEGACY_SHOWN_KEY,
    );
    expect(mockSecureStoreSetItemAsync).not.toHaveBeenCalled();
  });
});

describe('revokePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue({ success: true });
  });

  it('calls the revoke endpoint with the matching token', async () => {
    await revokePushToken('ExponentPushToken[abc]');
    expect(mockApiPost).toHaveBeenCalledWith('/push-tokens/revoke', {
      token: 'ExponentPushToken[abc]',
    });
  });

  it('throws when the revoke request fails', async () => {
    mockApiPost.mockRejectedValue(new Error('revoke error'));
    await expect(revokePushToken('bad-token')).rejects.toThrow('revoke error');
  });
});
