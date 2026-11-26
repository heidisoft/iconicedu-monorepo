import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FamilyScreen from './family';
const mockPush = jest.fn();
const mockRevoke = jest.fn();
const mockInvalidate = jest.fn();
let mockGuardian = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({
    guardianProfileId: mockGuardian ? 'parent-profile' : '',
    guardianAccountId: 'parent-account',
  }),
}));
jest.mock('@/hooks/use-family-links', () => ({
  useFamilyLinks: () => ({ links: [], childProfiles: [], isLoading: false }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [
      {
        id: 'invite-id',
        invitedEmail: 'child@example.invalid',
        expiresAt: '2100-01-01T00:00:00Z',
      },
    ],
    isError: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/lib/api/family-invites', () => ({
  fetchFamilyChildInvites: jest.fn(),
  revokeFamilyChildInvite: (...args: unknown[]) => mockRevoke(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockGuardian = true;
  mockRevoke.mockResolvedValue({ success: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
it('keeps both email invitations and creating managed profiles available', () => {
  render(<FamilyScreen />);
  fireEvent.press(screen.getByText('Invite child by email'));
  expect(mockPush).toHaveBeenCalledWith('/(app)/settings/invite-child');
  fireEvent.press(screen.getByText('Add new child'));
  expect(mockPush).toHaveBeenCalledWith('/(app)/settings/child');
  expect(screen.getByText('Pending invitations')).toBeTruthy();
  expect(screen.getByText('child@example.invalid')).toBeTruthy();
});
it('confirms cancellation before revoking a pending invitation', async () => {
  render(<FamilyScreen />);
  fireEvent.press(screen.getByLabelText('Cancel child invitation'));
  expect(mockRevoke).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    await buttons.find((button) => button.text === 'Cancel invitation')!.onPress!();
  });
  await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('invite-id'));
  expect(mockInvalidate).toHaveBeenCalledWith({
    queryKey: ['family-child-invites', 'parent-account'],
  });
});
it('does not expose guardian family actions to other roles', () => {
  mockGuardian = false;
  render(<FamilyScreen />);
  expect(screen.queryByText('Invite child by email')).toBeNull();
  expect(screen.queryByText('Add new child')).toBeNull();
  expect(screen.queryByText('Pending invitations')).toBeNull();
});
