import React from 'react';
import { Alert, Modal } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileItemEditor } from './profile-item-editor';
import type { ProfileSettingsResult } from '@/lib/api/profile-settings';
const mockSave = jest.fn();
const mockMode = jest.fn();
const mockClose = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
    mode: 'system',
    setMode: mockMode,
  }),
}));
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({ refresh: mockRefresh }),
}));
jest.mock('@/lib/api/profile-settings', () => ({
  saveProfileSettings: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('@/components/auth/timezone-options', () => ({
  timezoneIds: () => ['UTC', 'Asia/Colombo'],
  timezoneOption: (id: string) => ({ id, label: id }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@iconicedu/ui-native/components/searchable-selection-sheet', () => ({
  SearchableSelectionSheet: ({
    options,
    onSelect,
    onClose,
    closeLabel,
    selectedId,
  }: {
    options: { id: string; label: string }[];
    onSelect: (o: { id: string; label: string }) => void;
    onClose: () => void;
    closeLabel: string;
    selectedId: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text testID="selected">{selectedId}</Text>
        <Pressable accessibilityLabel={closeLabel} onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
        {options.map((o) => (
          <Pressable
            key={o.id}
            accessibilityLabel={`Choose ${o.id}`}
            onPress={() => onSelect(o)}
          >
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));
const data: ProfileSettingsResult = {
  profile: {
    id: 'p1',
    org_id: 'org1',
    first_name: 'Jane',
    last_name: 'Smith',
    display_name: 'Jane S',
    country_code: 'US',
    region: 'Massachusetts',
    city: 'Boston',
    postal_code: '02108',
    timezone: 'UTC',
    locale: 'en-US',
    languages_spoken: ['English'],
    ui_theme_key: 'green',
  },
  canEdit: true,
  canRemove: true,
  childDetails: { birth_year: 2015 },
  gradeLevel: 'grade_5',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
async function confirm() {
  await act(async () => {
    jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((b) => b.text === 'Save')!.onPress!();
  });
}
it.each([
  [
    'birth_year',
    '2014',
    { section: 'child', values: { birthYear: 2014, gradeLevel: 'grade_5' } },
  ],
  [
    'grade_level',
    'grade_6',
    { section: 'child', values: { birthYear: 2015, gradeLevel: 'grade_6' } },
  ],
  [
    'timezone',
    'Asia/Colombo',
    { section: 'regional', values: { timezone: 'Asia/Colombo', locale: 'en-US' } },
  ],
  [
    'locale',
    'si-LK',
    { section: 'regional', values: { timezone: 'UTC', locale: 'si-LK' } },
  ],
  [
    'region',
    'California',
    {
      section: 'location',
      values: {
        location: {
          countryCode: 'US',
          region: 'California',
          city: 'Boston',
          postalCode: '02108',
        },
      },
    },
  ],
] as const)(
  'opens %s options directly and confirms before saving',
  async (field, value, expected) => {
    render(<ProfileItemEditor data={data} field={field} onClose={mockClose} />);
    fireEvent.press(screen.getByLabelText(`Choose ${value}`));
    expect(mockSave).not.toHaveBeenCalled();
    await confirm();
    expect(mockSave).toHaveBeenCalledWith('p1', expected);
    expect(mockClose).toHaveBeenCalled();
  },
);
it('confirms avatar accent choices before saving', async () => {
  render(<ProfileItemEditor data={data} field="ui_theme_key" onClose={mockClose} />);
  expect(screen.getByLabelText('green').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('blue'));
  expect(mockSave).not.toHaveBeenCalled();
  await confirm();
  expect(mockSave).toHaveBeenCalledWith('p1', {
    section: 'appearance',
    values: { themeKey: 'blue' },
  });
});
it('confirms the local theme without writing profile fields', async () => {
  render(<ProfileItemEditor data={data} field="mode" onClose={mockClose} />);
  fireEvent.press(screen.getByLabelText('Choose dark'));
  expect(mockMode).not.toHaveBeenCalled();
  await confirm();
  expect(mockMode).toHaveBeenCalledWith('dark');
  expect(mockSave).not.toHaveBeenCalled();
});
it('keeps picker value unchanged when confirmation is cancelled and ignores duplicate taps', () => {
  render(<ProfileItemEditor data={data} field="timezone" onClose={mockClose} />);
  fireEvent.press(screen.getByLabelText('Choose Asia/Colombo'));
  fireEvent.press(screen.getByLabelText('Choose Asia/Colombo'));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  act(() =>
    jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((b) => b.text === 'Cancel')!.onPress!(),
  );
  expect(screen.getByTestId('selected').props.children).toBe('UTC');
  fireEvent.press(screen.getByLabelText('Close Timezone editor'));
  expect(mockClose).toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
it('retains failed text edits and allows a retry', async () => {
  mockSave.mockRejectedValueOnce(new Error('Unable to save now'));
  render(<ProfileItemEditor data={data} field="city" onClose={mockClose} />);
  fireEvent.changeText(screen.getByLabelText('City'), 'Cambridge');
  fireEvent.press(screen.getByLabelText('Save City'));
  await confirm();
  expect(mockClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText('City').props.value).toBe('Cambridge');
  fireEvent.press(screen.getByLabelText('Save City'));
  await confirm();
  expect(mockClose).toHaveBeenCalled();
});
it('does not write on native close or after unmount while a confirmation is pending', async () => {
  const view = render(<ProfileItemEditor data={data} field="bio" onClose={mockClose} />);
  fireEvent.changeText(screen.getByLabelText('Bio'), 'Draft');
  fireEvent.press(screen.getByLabelText('Save Bio'));
  view.unmount();
  await confirm();
  expect(mockSave).not.toHaveBeenCalled();
});
it('does not expose editable controls when permission is denied', () => {
  render(
    <ProfileItemEditor
      data={{ ...data, canEdit: false }}
      field="bio"
      onClose={mockClose}
    />,
  );
  expect(screen.queryByLabelText('Save Bio')).toBeNull();
});
it('opens the complete address draft after a country change without writing early', () => {
  render(<ProfileItemEditor data={data} field="country_code" onClose={mockClose} />);
  expect(screen.getByLabelText('Choose LK')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Choose LK'));
  expect(screen.getByLabelText('Save section changes')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Cancel'));
  expect(mockClose).toHaveBeenCalled();
});

it('discards unsaved input when closed with the native back action', () => {
  const view = render(<ProfileItemEditor data={data} field="bio" onClose={mockClose} />);
  fireEvent.changeText(screen.getByLabelText('Bio'), 'Draft');
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(mockClose).toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
