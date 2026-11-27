import React from 'react';
import { Modal, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FamilyActionsTile } from './family-actions-tile';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
it('keeps all eligible actions accessible and waits for iOS dismissal before opening an intro', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  const add = jest.fn(),
    refer = jest.fn(),
    request = jest.fn();
  const view = render(
    <FamilyActionsTile
      referralsEnabled
      onAddChild={add}
      onRefer={refer}
      onRequestClass={request}
    />,
  );
  fireEvent.press(screen.getByLabelText('More for your family'));
  expect(screen.getByLabelText('Refer a friend')).toBeTruthy();
  expect(screen.getByLabelText('Add a child')).toBeTruthy();
  expect(screen.getByLabelText('Request a class')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Add a child'));
  expect(add).not.toHaveBeenCalled();
  fireEvent(view.UNSAFE_getByType(Modal), 'dismiss');
  expect(add).toHaveBeenCalledTimes(1);
  expect(refer).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  platform.restore();
});
it('respects the referral flag and student eligibility without removing Add child', () => {
  render(<FamilyActionsTile onAddChild={jest.fn()} onRefer={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('More for your family'));
  expect(screen.queryByLabelText('Refer a friend')).toBeNull();
  expect(screen.queryByLabelText('Request a class')).toBeNull();
  expect(screen.getByLabelText('Add a child')).toBeTruthy();
});
it('can close and reopen the action list without performing an action', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const add = jest.fn();
  render(<FamilyActionsTile onAddChild={add} />);
  fireEvent.press(screen.getByLabelText('More for your family'));
  fireEvent.press(screen.getByLabelText('Close family actions'));
  expect(add).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('More for your family'));
  fireEvent.press(screen.getByLabelText('Add a child'));
  expect(add).toHaveBeenCalledTimes(1);
  platform.restore();
});
it('does not open an action that becomes unavailable during native dismissal', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  const refer = jest.fn(),
    add = jest.fn();
  const view = render(
    <FamilyActionsTile referralsEnabled onAddChild={add} onRefer={refer} />,
  );
  fireEvent.press(screen.getByLabelText('More for your family'));
  fireEvent.press(screen.getByLabelText('Refer a friend'));
  view.rerender(
    <FamilyActionsTile referralsEnabled={false} onAddChild={add} onRefer={refer} />,
  );
  fireEvent(view.UNSAFE_getByType(Modal), 'dismiss');
  expect(refer).not.toHaveBeenCalled();
  platform.restore();
});
