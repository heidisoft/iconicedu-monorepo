import {
  PUSH_TOKEN_STORE_KEY,
  getExpoPushToken,
  getStoredPushToken,
  revokePushToken,
  storePushToken,
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
  isDevice: true,
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
  easConfig: null,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
      update: mockUpdate,
    })),
  },
}));

describe('getExpoPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

describe('storePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSecureStoreSetItemAsync.mockResolvedValue(undefined);
  });

  it('upserts the token with correct fields', async () => {
    await storePushToken('org-1', 'profile-1', 'ExponentPushToken[abc]');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        profile_id: 'profile-1',
        token: 'ExponentPushToken[abc]',
        platform: 'ios',
        revoked_at: null,
      }),
      { onConflict: 'token' },
    );
  });

  it('persists token to SecureStore after successful DB upsert', async () => {
    await storePushToken('org-1', 'profile-1', 'ExponentPushToken[abc]');
    expect(mockSecureStoreSetItemAsync).toHaveBeenCalledWith(
      PUSH_TOKEN_STORE_KEY,
      'ExponentPushToken[abc]',
    );
  });

  it('throws when supabase returns an error and does not call SecureStore', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });
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
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it('sets revoked_at on the matching token', async () => {
    await revokePushToken('ExponentPushToken[abc]');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
    expect(mockEq).toHaveBeenCalledWith('token', 'ExponentPushToken[abc]');
  });

  it('throws when supabase returns an error', async () => {
    mockEq.mockResolvedValue({ error: { message: 'revoke error' } });
    await expect(revokePushToken('bad-token')).rejects.toThrow('revoke error');
  });
});
