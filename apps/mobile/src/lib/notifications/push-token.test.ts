import {
  PUSH_TOKEN_STORE_KEY,
  getExpoPushToken,
  getStoredPushToken,
  revokePushToken,
  storePushToken,
  supportsNativePushNotifications,
} from './push-token';

const mockSecureStoreSetItemAsync = jest.fn();
const mockSecureStoreGetItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSecureStoreSetItemAsync(...args),
  getItemAsync: (...args: unknown[]) => mockSecureStoreGetItemAsync(...args),
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
  Platform: { OS: 'ios' },
}));

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
