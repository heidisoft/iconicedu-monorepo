import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileTextField } from './profile-field-editor';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));

it('opens the current value, discards closed edits and applies Done to the draft only', () => {
  const onChange = jest.fn();
  render(<ProfileTextField label="First name" value="Jane" onChange={onChange} />);
  expect(screen.queryByLabelText('First name')).toBeNull();
  fireEvent.press(screen.getByLabelText('Edit First name'));
  expect(screen.getByLabelText('First name').props.value).toBe('Jane');
  expect(screen.getByLabelText('First name').props.autoFocus).toBe(true);
  fireEvent.changeText(screen.getByLabelText('First name'), 'Discarded');
  fireEvent.press(screen.getByLabelText('Close First name editor'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Edit First name'));
  expect(screen.getByLabelText('First name').props.value).toBe('Jane');
  fireEvent.changeText(screen.getByLabelText('First name'), 'Janet');
  fireEvent.press(screen.getByLabelText('Done editing First name'));
  expect(onChange).toHaveBeenCalledWith('Janet');
  expect(screen.queryByLabelText('First name')).toBeNull();
});

it('discards edits on the native back action', () => {
  const onChange = jest.fn();
  const view = render(
    <ProfileTextField label="Bio" value="" onChange={onChange} multiline />,
  );
  fireEvent.press(screen.getByLabelText('Edit Bio'));
  fireEvent.changeText(screen.getByLabelText('Bio'), 'Discarded');
  const modal = view.UNSAFE_getByType(require('react-native').Modal);
  fireEvent(modal, 'requestClose');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Bio')).toBeNull();
});

it('does not open disabled fields', () => {
  render(
    <ProfileTextField label="First name" value="Jane" onChange={jest.fn()} disabled />,
  );
  fireEvent.press(screen.getByLabelText('Edit First name'));
  expect(screen.queryByLabelText('First name')).toBeNull();
});
