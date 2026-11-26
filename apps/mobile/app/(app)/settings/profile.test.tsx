import React from 'react';
import { render } from '@testing-library/react-native';
import ProfileSettingsScreen from './profile';

let mockParams: { profileId?: string } = {};
const mockEditor = jest.fn((_props: unknown) => null);
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { id: 'parent-profile' } }),
}));
jest.mock('@/components/profile/profile-editor', () => ({
  ProfileEditor: (props: unknown) => mockEditor(props),
}));
beforeEach(() => {
  mockParams = {};
  mockEditor.mockClear();
});
it('uses the current profile for the main Profile screen', () => {
  render(<ProfileSettingsScreen />);
  expect(mockEditor).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: 'parent-profile', child: false, profileOnly: true }),
  );
});
it('keeps the selected child ID when opening the shared Profile screen', () => {
  mockParams = { profileId: 'child-profile' };
  render(<ProfileSettingsScreen />);
  expect(mockEditor).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: 'child-profile', child: true, profileOnly: true }),
  );
});
