import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor, ProfileSectionEditButton } from './profile-editor';
import { ProfileSectionForm } from './profile-section-form';

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
it('requires confirmation and preserves edits when review is cancelled', () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit profile name'));
  fireEvent.press(screen.getByLabelText('Edit First name'));
  fireEvent.changeText(screen.getByLabelText('First name'), 'Janet');
  fireEvent.press(screen.getByLabelText('Done editing First name'));
  fireEvent.press(screen.getByLabelText('Save section changes'));
  expect(mockSave).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  act(() => buttons.find((button) => button.text === 'Cancel')!.onPress!());
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Edit First name').props.accessibilityValue.text).toBe(
    'Janet',
  );
});
it('saves the reviewed values only after explicit confirmation', async () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit profile name'));
  fireEvent.press(screen.getByLabelText('Edit First name'));
  fireEvent.changeText(screen.getByLabelText('First name'), 'Janet');
  fireEvent.press(screen.getByLabelText('Done editing First name'));
  fireEvent.press(screen.getByLabelText('Save section changes'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Save')!.onPress!();
  });
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith('p1', {
      section: 'identity',
      values: { firstName: 'Janet', lastName: 'Smith', displayName: 'Jane S' },
    }),
  );
  await waitFor(() => expect(screen.queryByLabelText('Save section changes')).toBeNull());
  expect(mockBack).not.toHaveBeenCalled();
});
it('shows restricted child details without save or remove controls', () => {
  mockCanEdit = false;
  render(<ProfileEditor id="p1" child />);
  expect(screen.queryByLabelText('First name')).toBeNull();
  expect(screen.queryByLabelText('Edit profile name')).toBeNull();
  expect(screen.getByText('Jane S')).toBeTruthy();
  expect(screen.queryByText('Review changes')).toBeNull();
  expect(screen.queryByText('Remove child')).toBeNull();
});
it('does not remove a child until the destructive confirmation is accepted', async () => {
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByText('Remove child'));
  expect(mockRemove).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    await buttons.find((button) => button.text === 'Remove child')!.onPress!();
  });
  await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('p1'));
});

it('directs guardians to support when assignments block removal', () => {
  mockRemovalBlocked = true;
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByText('Contact support to remove child'));
  expect(Alert.alert).toHaveBeenCalledWith(
    'Contact support to remove child',
    expect.stringContaining('Live Support'),
  );
  expect(mockRemove).not.toHaveBeenCalled();
});

it('keeps the original data rows read-only until a section is opened', () => {
  render(<ProfileEditor id="p1" />);
  expect(screen.getByText('Display Name')).toBeTruthy();
  expect(screen.getByText('First Name')).toBeTruthy();
  expect(screen.getByText('Last Name')).toBeTruthy();
  expect(screen.queryByLabelText('First name')).toBeNull();
  expect(screen.getByLabelText('Edit profile name')).toBeTruthy();
  expect(screen.getByLabelText('Edit Photo')).toBeTruthy();
  expect(screen.queryByLabelText('Edit Location')).toBeNull();
  expect(screen.queryByLabelText('Edit Regional')).toBeNull();
  expect(screen.queryByLabelText('Edit Visibility')).toBeNull();
});
it('edits only the selected section and discards changes on cancel', () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit profile name'));
  fireEvent.press(screen.getByLabelText('Edit First name'));
  fireEvent.changeText(screen.getByLabelText('First name'), 'Discarded');
  fireEvent.press(screen.getByLabelText('Done editing First name'));
  expect(screen.queryByLabelText('Hide account role')).toBeNull();
  expect(screen.queryByLabelText('Choose profile photo')).toBeNull();
  fireEvent.press(screen.getByText('Cancel'));
  fireEvent.press(screen.getByLabelText('Edit profile name'));
  expect(screen.getByLabelText('Edit First name').props.accessibilityValue.text).toBe(
    'Jane',
  );
  expect(mockSave).not.toHaveBeenCalled();
});
it('saves visibility without sending identity or regional fields', async () => {
  render(
    <ProfileSectionEditButton id="p1" section="visibility" title="Account visibility" />,
  );
  fireEvent.press(screen.getByLabelText('Edit Account visibility'));
  fireEvent(screen.getByLabelText('Hide account role'), 'valueChange', true);
  fireEvent.press(screen.getByLabelText('Save section changes'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Save')!.onPress!();
  });
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith('p1', {
      section: 'visibility',
      values: { hideRole: true, hideStatus: false },
    }),
  );
});

it('opens regional editing with pickers and spoken languages only', () => {
  render(<ProfileSectionEditButton id="p1" section="regional" />);
  fireEvent.press(screen.getByLabelText('Edit Regional'));
  expect(screen.getByLabelText('Choose Time Zone')).toBeTruthy();
  expect(screen.getByLabelText('Choose Language / Region')).toBeTruthy();
  expect(
    screen.getByLabelText('Edit Languages spoken').props.accessibilityValue.text,
  ).toBe('Not set');
  expect(screen.queryByLabelText('First name')).toBeNull();
  expect(screen.queryByLabelText('Hide account role')).toBeNull();
});

it('uses the existing settings screens for child location and preferences', () => {
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByText('Profile'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(app)/settings/profile',
    params: { profileId: 'p1' },
  });
  expect(screen.queryByText('First Name')).toBeNull();
  expect(screen.getByText('Personal')).toBeTruthy();
  expect(screen.getAllByText('Account').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText('Location'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(app)/settings/location',
    params: { profileId: 'p1' },
  });
  fireEvent.press(screen.getByText('Preferences'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(app)/settings/preferences',
    params: { profileId: 'p1' },
  });
  expect(screen.queryByText('Country')).toBeNull();
  expect(screen.queryByText('Time Zone')).toBeNull();
});
it('keeps photo editing separate from appearance preferences', async () => {
  mockChoosePhoto.mockResolvedValue('file:///profile-photo.jpg');
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit Photo'));
  await waitFor(() => expect(screen.getByText('Change photo')).toBeTruthy());
  expect(mockChoosePhoto).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.queryByText('Accent color')).toBeNull();
  expect(screen.queryByLabelText('First name')).toBeNull();
});

it('edits appearance inside Preferences without applying draft theme changes on cancel', () => {
  render(<ProfileSectionEditButton id="p1" section="appearance" />);
  fireEvent.press(screen.getByLabelText('Edit Appearance'));
  fireEvent.press(screen.getByLabelText('Theme: System. Change theme'));
  fireEvent.press(screen.getByLabelText('Dark'));
  expect(mockSetMode).not.toHaveBeenCalled();
  expect(screen.queryByText('Choose profile photo')).toBeNull();
  fireEvent.press(screen.getByText('Cancel'));
  expect(mockSetMode).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
it('confirms appearance before saving accent and applying the local theme', async () => {
  render(<ProfileSectionEditButton id="p1" section="appearance" />);
  fireEvent.press(screen.getByLabelText('Edit Appearance'));
  fireEvent.press(screen.getByLabelText('Theme: System. Change theme'));
  fireEvent.press(screen.getByLabelText('Dark'));
  fireEvent.press(screen.getByLabelText('Edit Accent color'));
  fireEvent.press(screen.getByLabelText('blue'));
  fireEvent.press(screen.getByLabelText('Save section changes'));
  expect(mockSave).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Save')!.onPress!();
  });
  expect(mockSave).toHaveBeenCalledWith('p1', {
    section: 'appearance',
    values: { themeKey: 'blue' },
  });
  expect(mockSetMode).toHaveBeenCalledWith('dark');
});

it('does not open the photo editor or save when the source chooser is cancelled', async () => {
  render(<ProfileEditor id="p1" />);
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Edit Photo'));
  });
  expect(mockChoosePhoto).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Save section changes')).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
});

it('invites a managed child from their sectioned profile using the existing child ID', () => {
  render(<ProfileEditor id="p1" child />);
  fireEvent.press(screen.getByLabelText('Invite child by email'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(app)/settings/invite-child',
    params: { profileId: 'p1' },
  });
});

it.each([false, true])(
  'omits account role/status sections from profiles (child=%s)',
  (child) => {
    render(<ProfileEditor id="p1" child={child} profileOnly />);
    expect(screen.queryByText('Visibility')).toBeNull();
    expect(screen.queryByText('Account Role')).toBeNull();
    expect(screen.queryByText('Account Status')).toBeNull();
    expect(screen.queryByLabelText('Edit Visibility')).toBeNull();
    expect(screen.getByText('First Name')).toBeTruthy();
  },
);

it('previews accent colors as profile avatars and keeps dismissed theme choices unchanged', () => {
  render(<ProfileSectionEditButton id="p1" section="appearance" />);
  fireEvent.press(screen.getByLabelText('Edit Appearance'));
  fireEvent.press(screen.getByLabelText('Edit Accent color'));
  expect(screen.getByTestId('accent-avatar-blue').props.style.backgroundColor).toBe(
    profileAvatarColors({ themeKey: 'blue', seed: 'p1' }).bg,
  );
  fireEvent.press(screen.getByLabelText('blue'));
  expect(screen.getByLabelText('Edit Accent color').props.accessibilityValue.text).toBe(
    'Blue',
  );
  fireEvent.press(screen.getByLabelText('Edit Accent color'));
  expect(screen.getByLabelText('blue').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Close Accent color editor'));
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Theme: System. Change theme'));
  expect(screen.getByLabelText('System').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Close theme picker'));
  expect(screen.getByLabelText('Theme: System. Change theme')).toBeTruthy();
  expect(mockSetMode).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});

it('uses the shared profile sections for the separate child Profile screen', () => {
  render(<ProfileEditor id="p1" child profileOnly />);
  expect(screen.getByLabelText('Edit profile name')).toBeTruthy();
  expect(screen.getByLabelText('Edit About')).toBeTruthy();
  expect(screen.getByLabelText('Edit Learning Details')).toBeTruthy();
  expect(screen.queryByText('Location')).toBeNull();
  expect(screen.queryByText('Preferences')).toBeNull();
  expect(screen.queryByText('Remove child')).toBeNull();
});

it.each([false, true])(
  'keeps per-field edits local and discards them when the section closes (child=%s)',
  (child) => {
    render(<ProfileEditor id="p1" child={child} profileOnly />);
    fireEvent.press(screen.getByLabelText('Edit profile name'));
    fireEvent.press(screen.getByLabelText('Edit First name'));
    fireEvent.changeText(screen.getByLabelText('First name'), 'Janet');
    fireEvent.press(screen.getByLabelText('Done editing First name'));
    fireEvent.press(screen.getByLabelText('Edit Last name'));
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Discarded');
    fireEvent.press(screen.getByLabelText('Close Last name editor'));
    expect(screen.getByLabelText('Edit First name').props.accessibilityValue.text).toBe(
      'Janet',
    );
    expect(screen.getByLabelText('Edit Last name').props.accessibilityValue.text).toBe(
      'Smith',
    );
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Cancel'));
    fireEvent.press(screen.getByLabelText('Edit profile name'));
    expect(screen.getByLabelText('Edit First name').props.accessibilityValue.text).toBe(
      'Jane',
    );
  },
);

it('checks required names after field editing before offering database confirmation', () => {
  render(<ProfileEditor id="p1" />);
  fireEvent.press(screen.getByLabelText('Edit profile name'));
  fireEvent.press(screen.getByLabelText('Edit Last name'));
  fireEvent.changeText(screen.getByLabelText('Last name'), ' ');
  fireEvent.press(screen.getByLabelText('Done editing Last name'));
  fireEvent.press(screen.getByLabelText('Save section changes'));
  expect(Alert.alert).toHaveBeenLastCalledWith('Check names', expect.any(String));
  expect(mockSave).not.toHaveBeenCalled();
});

it('edits address text in a focused sheet and saves only the confirmed location draft', async () => {
  render(
    <ProfileSectionForm
      section="location"
      profile={{
        id: 'p1',
        country_code: 'US',
        city: 'Boston',
        region: 'MA',
        postal_code: '02108',
      }}
    />,
  );
  fireEvent.press(screen.getByLabelText('Edit City'));
  fireEvent.changeText(screen.getByLabelText('City'), 'Cambridge');
  fireEvent.press(screen.getByLabelText('Done editing City'));
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Save section changes'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Save')!.onPress!();
  });
  expect(mockSave).toHaveBeenCalledWith('p1', {
    section: 'location',
    values: {
      location: {
        countryCode: 'US',
        city: 'Cambridge',
        region: 'MA',
        postalCode: '02108',
      },
    },
  });
});

it.each([false, true])(
  'opens identity from the displayed name without an Identity Edit action (child=%s)',
  (child) => {
    render(<ProfileEditor id="p1" child={child} profileOnly />);
    expect(screen.queryByLabelText('Edit Identity')).toBeNull();
    expect(screen.getByLabelText('Edit profile name').props.accessibilityValue.text).toBe(
      'Jane S',
    );
    fireEvent.press(screen.getByLabelText('Edit profile name'));
    expect(screen.getByLabelText('Edit Display name')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Cancel'));
    fireEvent.press(screen.getByLabelText('Display Name'));
    expect(screen.getByLabelText('Edit Display name')).toBeTruthy();
  },
);
