import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Screen from './[code]';
const mockReplace = jest.fn();
const mockSave = jest.fn();
const mockResolve = jest.fn();
const mockStatus = jest.fn();
let mockEnabled = true;
let mockCode = 'a'.repeat(48);
let mockSession: { user: { id: string } } | null = null;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: mockCode }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mockSession }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: () => mockEnabled,
}));
jest.mock('@/lib/api/parent-referrals', () => ({
  resolveParentReferral: (...args: unknown[]) => mockResolve(...args),
}));
jest.mock('@/lib/api/onboarding/queries', () => ({
  fetchOnboardingStatus: () => mockStatus(),
}));
jest.mock('@/lib/referrals/pending-referral', () => ({
  ...jest.requireActual('@/lib/referrals/pending-referral'),
  savePendingParentReferral: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('expo-secure-store', () => ({}));
function show() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
      }
    >
      <Screen />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockEnabled = true;
  mockSession = null;
  mockCode = 'a'.repeat(48);
  mockResolve.mockResolvedValue({
    referrerName: 'Test Parent',
    orgSlug: 'academy',
    rewardLabel: '$20 off',
  });
  mockSave.mockResolvedValue(undefined);
});
it('requires an explicit acceptance before saving and preserves the invitation before routing to signup', async () => {
  show();
  await screen.findByText('Invited by Test Parent');
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Accept invitation and continue'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  expect(mockSave).toHaveBeenCalledWith(mockCode, null);
});
it('supports pasting the original invitation after installation', async () => {
  mockCode = 'manual';
  show();
  expect(mockResolve).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText('Invitation link or code'),
    `https://www.iconicedu.com/r/${'b'.repeat(48)}`,
  );
  await screen.findByText('Invited by Test Parent');
  fireEvent.press(screen.getByText('Accept invitation and continue'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith('b'.repeat(48), null));
});
it('hides referral actions and performs no lookup with the flag off', () => {
  mockEnabled = false;
  show();
  expect(screen.queryByText('Accept invitation and continue')).toBeNull();
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not attach an invitation to an existing account', async () => {
  mockSession = { user: { id: 'existing-parent' } };
  mockStatus.mockResolvedValueOnce({ primaryRole: 'guardian' });
  show();
  await screen.findByText('Invited by Test Parent');
  fireEvent.press(screen.getByText('Accept invitation and continue'));
  await screen.findByText(/Invitations apply to new parent accounts only/);
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
it('does not leave the screen if encrypted storage fails', async () => {
  mockSave.mockRejectedValueOnce(new Error('Storage unavailable'));
  show();
  await screen.findByText('Invited by Test Parent');
  fireEvent.press(screen.getByText('Accept invitation and continue'));
  await screen.findByText('Storage unavailable');
  expect(mockReplace).not.toHaveBeenCalled();
});
