import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AddChildDraft } from './add-child-draft';
const mockCreate = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      profile: {
        id: 'parent-profile',
        org_id: 'org',
        timezone: 'Asia/Colombo',
        locale: 'en-GB',
        country_code: 'LK',
        country_name: 'Sri Lanka',
        city: 'Colombo',
        region: 'Western Province',
        postal_code: '00100',
      },
    },
    isPending: false,
    isError: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
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
    setMode: jest.fn(),
  }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { email: 'parent@example.invalid' } }),
}));
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({
    guardianProfileId: 'parent-profile',
    familySwitchOptions: [{ profileId: 'parent-profile' }],
    refresh: mockRefresh,
  }),
}));
jest.mock('@/lib/api/profile-settings', () => ({
  fetchProfileSettings: jest.fn(),
  saveProfileSettings: jest.fn(),
}));
jest.mock('@/lib/api/queries', () => ({
  createChildProfile: (...args: unknown[]) => mockCreate(...args),
}));
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));
jest.mock('@/lib/profile-photo-picker', () => ({ chooseProfilePhoto: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/components/auth/grade-level-select', () => ({
  GradeLevelSelect: ({ onChange }: { onChange: (value: string) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityLabel="Choose grade" onPress={() => onChange('grade_5')}>
        <Text>Grade</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/components/auth/birth-year-select', () => ({
  BirthYearSelect: ({ onChange }: { onChange: (value: string) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityLabel="Choose birth year" onPress={() => onChange('2015')}>
        <Text>Birth year</Text>
      </Pressable>
    );
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ ids: { id: 'created-child' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
function fillRequired() {
  fireEvent.press(screen.getByLabelText('Edit Identity'));
  fireEvent.changeText(screen.getByLabelText('First name'), 'Jane');
  fireEvent.changeText(screen.getByLabelText('Last name'), 'Doe');
  fireEvent.press(screen.getByLabelText('Save section changes'));
  fireEvent.press(screen.getByLabelText('Edit Learning Details'));
  fireEvent.press(screen.getByLabelText('Choose grade'));
  fireEvent.press(screen.getByLabelText('Choose birth year'));
  fireEvent.press(screen.getByLabelText('Save section changes'));
}
it('shows familiar profile sections instead of one large registration form', () => {
  render(<AddChildDraft />);
  expect(screen.getByLabelText('Edit Identity')).toBeTruthy();
  expect(screen.getByLabelText('Edit Learning Details')).toBeTruthy();
  expect(screen.getByLabelText('Edit child email')).toBeTruthy();
  expect(screen.queryByLabelText('First name')).toBeNull();
  expect(screen.queryByLabelText('Edit Photo')).toBeNull();
  fireEvent.press(screen.getByText('Add child'));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Complete child details', expect.any(String));
});
it('keeps draft sections local until final confirmation, then inherits parent location and timezone', async () => {
  render(<AddChildDraft />);
  fillRequired();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getAllByText('Jane D').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByLabelText('Edit child email'));
  fireEvent.changeText(screen.getByLabelText('Child email'), ' Child@Example.Invalid ');
  fireEvent.press(screen.getByLabelText('Save child email'));
  fireEvent.press(screen.getByText('Add child'));
  expect(mockCreate).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Add child')!.onPress!();
  });
  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane D',
        gradeLevel: 'grade_5',
        birthYear: 2015,
        email: 'child@example.invalid',
        timezone: 'Asia/Colombo',
        countryCode: 'LK',
        city: 'Colombo',
        postalCode: '00100',
      }),
    ),
  );
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(app)/settings/child',
    params: { id: 'created-child' },
  });
});
it('allows a managed child without email, matching web creation', async () => {
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.press(screen.getByText('Add child'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Add child')!.onPress!();
  });
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('email');
});
it('discards a cancelled identity draft and rejects parent email', () => {
  render(<AddChildDraft />);
  fireEvent.press(screen.getByLabelText('Edit Identity'));
  fireEvent.changeText(screen.getByLabelText('First name'), 'Discarded');
  fireEvent.press(screen.getByText('Cancel'));
  fireEvent.press(screen.getByLabelText('Edit Identity'));
  expect(screen.getByLabelText('First name').props.value).toBe('');
  fireEvent.press(screen.getByText('Cancel'));
  fireEvent.press(screen.getByLabelText('Edit child email'));
  fireEvent.changeText(screen.getByLabelText('Child email'), 'PARENT@example.invalid');
  fireEvent.press(screen.getByLabelText('Save child email'));
  expect(Alert.alert).toHaveBeenCalledWith(
    'Check email',
    'Child email cannot match the parent email.',
  );
  expect(mockCreate).not.toHaveBeenCalled();
});
