import { renderHook, waitFor } from '@testing-library/react-native';

import { usePushRegistration } from './use-push-registration';

const mockGetExpoPushToken = jest.fn();
const mockStorePushToken = jest.fn();

jest.mock('@/lib/notifications/push-token', () => ({
  getExpoPushToken: (...args: unknown[]) => mockGetExpoPushToken(...args),
  storePushToken: (...args: unknown[]) => mockStorePushToken(...args),
}));

const mockAccountData: Record<string, unknown> = { id: 'acc-1', org_id: 'org-1' };
const mockProfileData: Record<string, unknown> = { id: 'profile-1' };

jest.mock('./use-account', () => ({
  useAccount: () => ({ data: mockAccountData }),
}));

jest.mock('./use-profile', () => ({
  useProfile: () => ({ data: mockProfileData }),
}));

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorePushToken.mockResolvedValue(undefined);
  });

  it('registers and stores token when account and profile are available', async () => {
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[test]');

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockGetExpoPushToken).toHaveBeenCalled();
    });
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
});
