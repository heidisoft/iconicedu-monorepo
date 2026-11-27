import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor, screen } from '@testing-library/react-native';
import AppLayout from './_layout';
const mockFetch = jest.fn();
const mockRead = jest.fn();
const mockClear = jest.fn();
const mockReplace = jest.fn();
const mockSetComplete = jest.fn();
const mockSession = { user: { id: 'signed-in-parent' } };
const mockClient = { fetchQuery: mockFetch };
const mockRouter = { replace: mockReplace };
jest.mock('expo-router', () => {
  const { Text: NativeText } = require('react-native');
  return {
    Stack: () => <NativeText>App content</NativeText>,
    useRouter: () => mockRouter,
  };
});
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    session: mockSession,
    loading: false,
    setOnboardingCompletionStatus: mockSetComplete,
  }),
}));
jest.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@/hooks/use-notification-handler', () => ({
  useNotificationHandler: () => {},
}));
jest.mock('@/providers/push-consent-provider', () => ({
  PushConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/lib/api/queries', () => ({ fetchOnboardingStatus: jest.fn() }));
jest.mock('@/lib/referrals/pending-referral', () => ({
  readPendingParentReferral: (...args: unknown[]) => mockRead(...args),
  clearPendingParentReferral: (...args: unknown[]) => mockClear(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue({ code: 'a'.repeat(48), ownerId: 'signed-in-parent' });
  mockClear.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
it('consumes an invitation on an existing login without letting it leak to the next account', async () => {
  mockFetch.mockResolvedValueOnce({ isComplete: true });
  render(<AppLayout />);
  await screen.findByText('App content');
  expect(mockRead).toHaveBeenCalledWith('signed-in-parent');
  expect(mockClear).toHaveBeenCalledWith({
    code: 'a'.repeat(48),
    ownerId: 'signed-in-parent',
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Invitation',
    expect.stringContaining('new parent accounts only'),
  );
});
it('keeps the bound invitation when a new parent needs profile setup', async () => {
  mockFetch.mockResolvedValueOnce({ isComplete: false });
  render(<AppLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
  expect(mockClear).not.toHaveBeenCalled();
});
it('preserves the invitation when a new parent has no account yet', async () => {
  mockFetch.mockRejectedValueOnce(new Error('No account found'));
  render(<AppLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
  expect(mockRead).toHaveBeenCalledWith('signed-in-parent');
  expect(mockClear).not.toHaveBeenCalled();
});
