import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Screen from './[code]';
const mockReplace = jest.fn();
const mockSave = jest.fn();
const mockResolve = jest.fn();
const mockClear = jest.fn();
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
let mockEnabled = true;
let mockCode = 'a'.repeat(48);
let mockSession: { user: { id: string } } | null = null;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: mockCode }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
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
jest.mock('@/lib/referrals/pending-referral', () => ({
  ...jest.requireActual('@/lib/referrals/pending-referral'),
  savePendingParentReferral: (...args: unknown[]) => mockSave(...args),
  clearPendingParentReferral: (...args: unknown[]) => mockClear(...args),
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
  mockFocused = true;
  mockSession = null;
  mockCode = 'a'.repeat(48);
  mockResolve.mockResolvedValue({
    referrerName: 'Test Parent',
    orgSlug: 'academy',
    rewardLabel: '$20 off',
  });
  mockSave.mockResolvedValue(true);
  mockClear.mockResolvedValue(undefined);
});
it('requires an explicit acceptance before saving and preserves the invitation before routing to signup', async () => {
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  expect(screen.getByText('A personal invitation')).toBeTruthy();
  expect(screen.getByText('Support your child’s next step')).toBeTruthy();
  expect(screen.getByText('Explore classes for your child.')).toBeTruthy();
  expect(
    screen.getByText('Manage your children’s profiles and see their upcoming sessions.'),
  ).toBeTruthy();
  expect(
    screen.getByText('Stay connected with academy updates and messages.'),
  ).toBeTruthy();
  expect(screen.getByText(/As a thank-you for introducing your family/)).toBeTruthy();
  expect(screen.queryByText(/Accept this invitation to link/)).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Create your parent account'));
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
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  fireEvent.press(screen.getByText('Create your parent account'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith('b'.repeat(48), null));
});
it('hides referral actions and performs no lookup with the flag off', () => {
  mockEnabled = false;
  show();
  expect(screen.queryByText('Create your parent account')).toBeNull();
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not let a signed-in account accept any invitation, including its own', () => {
  mockSession = { user: { id: 'existing-parent' } };
  show();
  expect(screen.getByText('Invitations are for new parents')).toBeTruthy();
  expect(screen.queryByText('Create your parent account')).toBeNull();
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not leave the screen if encrypted storage fails', async () => {
  mockSave.mockRejectedValueOnce(new Error('Storage unavailable'));
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  fireEvent.press(screen.getByText('Create your parent account'));
  await screen.findByText('Storage unavailable');
  expect(mockReplace).not.toHaveBeenCalled();
});

it('clears an abandoned invitation before closing and returns safely to the welcome screen', async () => {
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  fireEvent.press(screen.getByLabelText('Close invitation'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not save or navigate after closing while a validation request is pending', async () => {
  let finish!: (value: object) => void;
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  mockResolve.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.press(screen.getByText('Create your parent account'));
  fireEvent.press(screen.getByLabelText('Close invitation'));
  await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
  finish({ referrerName: 'Test Parent' });
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  expect(mockSave).not.toHaveBeenCalled();
});

it('does not restore attribution after leaving during validation', async () => {
  let finish!: (value: object) => void;
  const view = show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  mockResolve.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.press(screen.getByText('Create your parent account'));
  view.unmount();
  finish({ referrerName: 'Test Parent' });
  await Promise.resolve();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
it('closes only once when close is pressed repeatedly', async () => {
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  fireEvent.press(screen.getByLabelText('Close invitation'));
  fireEvent.press(screen.getByLabelText('Close invitation'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it('keeps close failures recoverable instead of navigating with stale storage', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockClear.mockRejectedValueOnce(new Error('Storage unavailable'));
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  fireEvent.press(screen.getByLabelText('Close invitation'));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Unable to clear invitation', expect.any(String)),
  );
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close invitation'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  alert.mockRestore();
});

it('ignores late validation when navigation blurs the screen without unmounting it', async () => {
  let finish!: (value: object) => void;
  show();
  await screen.findByText('Test Parent invited you to ICONIC Academy.');
  mockResolve.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.press(screen.getByText('Create your parent account'));
  mockFocused = false;
  // A query update simulates the render caused by navigation focus changing.
  screen.rerender(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })
      }
    >
      <Screen />
    </QueryClientProvider>,
  );
  finish({ referrerName: 'Test Parent' });
  await Promise.resolve();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
