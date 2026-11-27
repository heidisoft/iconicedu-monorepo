import React from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';
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
  fireEvent.changeText(screen.getByLabelText('First name *'), 'Jane');
  fireEvent.changeText(screen.getByLabelText('Last name *'), 'Doe');
  fireEvent.press(screen.getByLabelText('Choose grade'));
  fireEvent.press(screen.getByLabelText('Choose birth year'));
}
it('shows fields directly without section edit actions', () => {
  render(<AddChildDraft />);
  expect(screen.getByLabelText('First name *')).toBeTruthy();
  expect(screen.getByLabelText('Last name *').props.placeholder).toBe('Last name');
  expect(screen.getByLabelText('First name *').props.placeholder).toBe('First name');
  expect(screen.getByLabelText('Display name (optional)')).toBeTruthy();
  expect(screen.getByLabelText('Email (optional)')).toBeTruthy();
  expect(screen.queryByLabelText('Edit Identity')).toBeNull();
  expect(screen.queryByLabelText('Edit Learning Details')).toBeNull();
  expect(screen.queryByLabelText('Edit child email')).toBeNull();
  expect(screen.getByText('New child')).toBeTruthy();
  expect(screen.getByText('Identity')).toBeTruthy();
  expect(screen.getByText('Learning Details')).toBeTruthy();
  expect(screen.getByText('Contact')).toBeTruthy();
  expect(screen.queryByLabelText('Edit Photo')).toBeNull();
  fireEvent.press(screen.getByText('Add child'));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Complete child details', expect.any(String));
});
it('keeps inputs local until confirmation, then inherits parent location and timezone', async () => {
  render(<AddChildDraft />);
  fillRequired();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Display name (optional)').props.placeholder).toBe(
    'Jane D',
  );
  expect(screen.getByText('Jane D')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Email (optional)'),
    ' Child@Example.Invalid ',
  );
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
it('allows a managed child without email and supports a custom display name', async () => {
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.changeText(screen.getByLabelText('Display name (optional)'), '  Janey  ');
  fireEvent.press(screen.getByText('Add child'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Add child')!.onPress!();
  });
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('email');
  expect(mockCreate.mock.calls[0][0].displayName).toBe('Janey');
});
it('retains entered values when the final confirmation is cancelled', () => {
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.press(screen.getByText('Add child'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  act(() => buttons.find((button) => button.text === 'Cancel')!.onPress!());
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByLabelText('First name *').props.value).toBe('Jane');
  expect(screen.getByLabelText('First name *').props.editable).toBe(true);
});
it.each([
  ['not-an-email', 'Enter a valid child email address.'],
  ['PARENT@example.invalid', 'Child email cannot match the parent email.'],
])('rejects invalid child email %s before confirming', (email, message) => {
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.changeText(screen.getByLabelText('Email (optional)'), email);
  fireEvent.press(screen.getByText('Add child'));
  expect(Alert.alert).toHaveBeenCalledWith('Check email', message);
  expect(mockCreate).not.toHaveBeenCalled();
});
it('does not accept whitespace-only required names', () => {
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.changeText(screen.getByLabelText('First name *'), '   ');
  fireEvent.press(screen.getByText('Add child'));
  expect(Alert.alert).toHaveBeenCalledWith('Complete child details', expect.any(String));
  expect(mockCreate).not.toHaveBeenCalled();
});
it('prevents duplicate confirmed requests and preserves the draft after a server error', async () => {
  let reject!: (error: Error) => void;
  mockCreate.mockReturnValueOnce(
    new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  render(<AddChildDraft />);
  fillRequired();
  fireEvent.press(screen.getByText('Add child'));
  const add = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find((button) => button.text === 'Add child')!;
  act(() => {
    add.onPress!();
    add.onPress!();
  });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('First name *').props.editable).toBe(false);
  await act(async () => {
    reject(new Error('Please try again.'));
  });
  expect(Alert.alert).toHaveBeenCalledWith('Unable to add child', 'Please try again.');
  expect(screen.getByLabelText('First name *').props.value).toBe('Jane');
  expect(screen.getByLabelText('First name *').props.editable).toBe(true);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('never renders bare strings in native containers, including whitespace', () => {
  function bareText(tree: ReactTestRendererJSON | ReactTestRendererJSON[] | null) {
    const found: { parent: string; text: string }[] = [];
    function visit(node: ReactTestRendererJSON | string) {
      if (typeof node === 'string') return;
      for (const child of node.children ?? []) {
        if (typeof child === 'string' && node.type !== 'Text')
          found.push({ parent: node.type, text: child });
        visit(child);
      }
    }
    if (tree) (Array.isArray(tree) ? tree : [tree]).forEach(visit);
    return found;
  }
  const view = render(<AddChildDraft />);
  expect(bareText(view.toJSON())).toEqual([]);
  fillRequired();
  expect(bareText(view.toJSON())).toEqual([]);
});
