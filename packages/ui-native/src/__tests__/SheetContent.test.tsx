import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SheetContent } from '../components/sheet-content';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'sheet-provider' }, children),
    SafeAreaView: (props: object) =>
      React.createElement(View, { ...props, testID: 'sheet-safe-area' }),
  };
});

it('uses a sheet-local safe area without adding the screen status-bar inset', () => {
  render(
    <SheetContent backgroundColor="#fff">
      <Text>Editor</Text>
    </SheetContent>,
  );
  expect(screen.getByTestId('sheet-provider')).toBeTruthy();
  const frame = screen.getByTestId('sheet-safe-area');
  expect(frame.props.edges).toEqual(['left', 'right', 'bottom']);
  expect(frame.props.style).toMatchObject({
    flex: 1,
    paddingTop: 24,
    backgroundColor: '#fff',
  });
  expect(screen.getByText('Editor')).toBeTruthy();
});
