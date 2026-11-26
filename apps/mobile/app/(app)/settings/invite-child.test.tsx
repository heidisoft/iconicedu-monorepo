import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InviteChildScreen from './invite-child';
const mockSend = jest.fn();
const mockBack = jest.fn();
const mockInvalidate = jest.fn();
let mockParams: { profileId?: string } = {};
let mockCanInvite = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      canInvite: mockCanInvite,
      childAccount: { email: 'managed@example.invalid', hasAuthAccount: false },
    },
    isPending: false,
    isError: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { email: 'parent@example.invalid' } }),
}));
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({ guardianProfileId: 'parent-profile', refresh: jest.fn() }),
}));
jest.mock('@/lib/api/profile-settings', () => ({ fetchProfileSettings: jest.fn() }));
jest.mock('@/lib/api/family-invites', () => ({
  sendFamilyChildInvite: (...args: unknown[]) => mockSend(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCanInvite = true;
  mockSend.mockResolvedValue({ id: 'invite' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
it('requires confirmation before sending an email invitation', async () => {
  render(<InviteChildScreen />);
  fireEvent.changeText(screen.getByLabelText('Child email'), ' Child@Example.Invalid ');
  fireEvent.press(screen.getByText('Send invite'));
  expect(mockSend).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Send invite')!.onPress!();
  });
  await waitFor(() =>
    expect(mockSend).toHaveBeenCalledWith({ invitedEmail: 'child@example.invalid' }),
  );
  expect(mockBack).toHaveBeenCalled();
});
it('can cancel confirmation without sending or losing the email draft', () => {
  render(<InviteChildScreen />);
  fireEvent.changeText(screen.getByLabelText('Child email'), 'child@example.invalid');
  fireEvent.press(screen.getByText('Send invite'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  act(() => buttons.find((button) => button.text === 'Cancel')!.onPress!());
  expect(mockSend).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Child email').props.value).toBe('child@example.invalid');
});
it('invites the selected managed profile instead of creating a duplicate child', async () => {
  mockParams = { profileId: 'existing-child' };
  render(<InviteChildScreen />);
  expect(screen.getByLabelText('Child email').props.value).toBe(
    'managed@example.invalid',
  );
  fireEvent.press(screen.getByText('Send invite'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Send invite')!.onPress!();
  });
  expect(mockSend).toHaveBeenCalledWith({
    invitedEmail: 'managed@example.invalid',
    targetProfileId: 'existing-child',
  });
});
it('does not expose sending controls for a restricted child', () => {
  mockParams = { profileId: 'restricted-child' };
  mockCanInvite = false;
  render(<InviteChildScreen />);
  expect(screen.queryByText('Send invite')).toBeNull();
});
it('rejects invalid and parent email addresses before confirmation', () => {
  render(<InviteChildScreen />);
  fireEvent.changeText(screen.getByLabelText('Child email'), 'bad');
  fireEvent.press(screen.getByText('Send invite'));
  expect(Alert.alert).toHaveBeenCalledWith(
    'Check email',
    'Enter a valid child email address.',
  );
  fireEvent.changeText(screen.getByLabelText('Child email'), 'parent@example.invalid');
  fireEvent.press(screen.getByText('Send invite'));
  expect(mockSend).not.toHaveBeenCalled();
});
