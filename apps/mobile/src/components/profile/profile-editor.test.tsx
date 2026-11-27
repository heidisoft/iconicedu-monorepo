import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor } from './profile-editor';

const mockSave = jest.fn();
const mockChoosePhoto = jest.fn();
const mockRemove = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSetMode = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn();
let mockCanEdit = true;
let mockRemovalBlocked = false;
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      profile: {
        id: 'p1',
        org_id: 'org1',
        first_name: 'Jane',
        last_name: 'Smith',
        display_name: 'Jane S',
        timezone: 'UTC',
        locale: 'en-US',
        ui_theme_key: 'green',
      },
      canEdit: mockCanEdit,
      canRemove: mockCanEdit,
      canInvite: mockCanEdit,
      childAccount: { email: 'child@example.invalid', hasAuthAccount: false },
      removalBlocked: mockRemovalBlocked,
      childDetails: { birth_year: 2015 },
      gradeLevel: 'grade_5',
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
    mode: 'system',
    setMode: mockSetMode,
  }),
}));
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({ refresh: mockRefresh }),
}));
jest.mock('@/lib/api/profile-settings', () => ({
  fetchProfileSettings: jest.fn(),
  saveProfileSettings: (...args: unknown[]) => mockSave(...args),
  removeFamilyChild: (...args: unknown[]) => mockRemove(...args),
}));
jest.mock('@/lib/api/queries', () => ({ createChildProfile: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));
jest.mock('@/lib/profile-photo-picker', () => ({
  chooseProfilePhoto: () => mockChoosePhoto(),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/components/auth/location-country-field', () => ({
  LocationCountryField: () => null,
}));
jest.mock('@/components/auth/location-address-fields', () => ({
  LocationAddressFields: () => null,
}));
jest.mock('@/components/auth/grade-level-select', () => ({
  GradeLevelSelect: () => null,
}));
jest.mock('@/components/auth/birth-year-select', () => ({ BirthYearSelect: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockChoosePhoto.mockResolvedValue(null);
  mockCanEdit = true;
  mockRemovalBlocked = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it.each([false, true])(
  'opens each identity field directly with no section Edit text (child=%s)',
  (child) => {
    render(<ProfileEditor id="p1" child={child} profileOnly />);
    expect(screen.queryByText('Edit')).toBeNull();
    for (const label of ['First Name', 'Last Name', 'Display Name']) {
      fireEvent.press(screen.getByLabelText(label));
      expect(screen.getAllByLabelText(label).at(-1)!.props.value).toBeTruthy();
      expect(screen.getByLabelText(`Save ${label}`)).toBeTruthy();
      expect(screen.queryByLabelText('Save section changes')).toBeNull();
      fireEvent.press(screen.getByLabelText(`Close ${label} editor`));
    }
    expect(mockSave).not.toHaveBeenCalled();
  },
);
it('saves a single name only after confirmation and preserves the other names', async () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('First Name'));
  fireEvent.changeText(screen.getAllByLabelText('First Name').at(-1)!, 'Janet');
  fireEvent.press(screen.getByLabelText('Save First Name'));
  expect(mockSave).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((b) => b.text === 'Save')!.onPress!();
  });
  expect(mockSave).toHaveBeenCalledWith('p1', {
    section: 'identity',
    values: { firstName: 'Janet', lastName: 'Smith', displayName: 'Jane S' },
  });
});
it('preserves input when confirmation is cancelled and discards it when the editor closes', () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('First Name'));
  fireEvent.changeText(screen.getAllByLabelText('First Name').at(-1)!, 'Janet');
  fireEvent.press(screen.getByLabelText('Save First Name'));
  act(() =>
    jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((b) => b.text === 'Cancel')!.onPress!(),
  );
  expect(screen.getAllByLabelText('First Name').at(-1)!.props.value).toBe('Janet');
  fireEvent.press(screen.getByLabelText('Close First Name editor'));
  fireEvent.press(screen.getByLabelText('First Name'));
  expect(screen.getAllByLabelText('First Name').at(-1)!.props.value).toBe('Jane');
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not offer editors to a view-only guardian', () => {
  mockCanEdit = false;
  render(<ProfileEditor id="p1" child profileOnly />);
  fireEvent.press(screen.getByLabelText('First Name'));
  expect(screen.queryByLabelText('Save First Name')).toBeNull();
  expect(screen.queryByText('Edit')).toBeNull();
  expect(screen.queryByLabelText('Edit profile name')).toBeNull();
});
it('opens bio directly without an About editor step', () => {
  render(<ProfileEditor id="p1" profileOnly />);
  fireEvent.press(screen.getByLabelText('Bio'));
  expect(screen.getByLabelText('Save Bio')).toBeTruthy();
  expect(screen.getAllByLabelText('Bio').at(-1)!.props.multiline).toBe(true);
});
it('requires confirmation before removing a child and blocks assigned children', async () => {
  const view = render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByText('Remove child'));
  expect(mockRemove).not.toHaveBeenCalled();
  await act(async () => {
    await jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((b) => b.text === 'Remove child')!.onPress!();
  });
  expect(mockRemove).toHaveBeenCalledWith('p1');
  view.unmount();
  mockRemovalBlocked = true;
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByText('Contact support to remove child'));
  expect(Alert.alert).toHaveBeenLastCalledWith(
    'Contact support to remove child',
    expect.stringContaining('Live Support'),
  );
  expect(mockRemove).toHaveBeenCalledTimes(1);
});
it('keeps the same child Profile, Location, Preferences navigation', () => {
  render(<ProfileEditor id="p1" child />);
  for (const label of ['Profile', 'Location', 'Preferences']) {
    fireEvent.press(screen.getByText(label));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: `/(app)/settings/${label.toLowerCase()}`,
      params: { profileId: 'p1' },
    });
  }
});
it('keeps the native photo source chooser and local preview', async () => {
  mockChoosePhoto.mockResolvedValue('file:///profile-photo.jpg');
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit Photo'));
  await waitFor(() => expect(screen.getByText('Change photo')).toBeTruthy());
  expect(mockChoosePhoto).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
});
it('invites the existing managed child by email', () => {
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByLabelText('Invite child by email'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(app)/settings/invite-child',
    params: { profileId: 'p1' },
  });
});
