import React from 'react';
import * as ReactNative from 'react-native';
import { Appearance, Text, useColorScheme } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockNativeWindSet = jest.fn();
const mockAppearanceGetColorScheme = jest.fn<'light' | 'dark' | null, []>();
const mockAppearanceRemove = jest.fn();
let appearanceChangeListener:
  | ((event: { colorScheme: 'light' | 'dark' | null }) => void)
  | null = null;

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.defineProperty(actual, 'useColorScheme', {
    value: jest.fn(),
  });
});

jest.mock('react-native-css-interop', () => ({
  colorScheme: {
    set: (...args: unknown[]) => mockNativeWindSet(...args),
  },
}));

import { ThemeProvider, useTheme } from './theme-provider';

const mockUseColorScheme = jest.mocked(useColorScheme);

function Consumer() {
  const { mode, colorScheme, isDark } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="scheme">{colorScheme}</Text>
      <Text testID="is-dark">{String(isDark)}</Text>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Appearance, 'getColorScheme')
      .mockImplementation(() => mockAppearanceGetColorScheme());
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation((listener) => {
      appearanceChangeListener = listener;
      return { remove: mockAppearanceRemove };
    });
    jest
      .spyOn(ReactNative, 'useColorScheme')
      .mockImplementation(() => mockUseColorScheme());
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
    mockAppearanceGetColorScheme.mockReturnValue('dark');
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('uses the device dark scheme in system mode and syncs NativeWind', async () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mode').props.children).toBe('system');
      expect(screen.getByTestId('scheme').props.children).toBe('dark');
      expect(screen.getByTestId('is-dark').props.children).toBe('true');
    });

    expect(mockNativeWindSet).toHaveBeenCalledWith('system');
  });

  it('updates when the OS appearance changes while following system mode', async () => {
    mockAppearanceGetColorScheme.mockReturnValue('light');
    mockUseColorScheme.mockReturnValue('light');

    const view = render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('scheme').props.children).toBe('light');
      expect(screen.getByTestId('is-dark').props.children).toBe('false');
    });

    act(() => {
      mockUseColorScheme.mockReturnValue('dark');
      appearanceChangeListener?.({ colorScheme: 'dark' });
    });
    mockUseColorScheme.mockReturnValue('dark');
    view.rerender(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    view.rerender(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('scheme').props.children).toBe('dark');
      expect(screen.getByTestId('is-dark').props.children).toBe('true');
    });

    expect(mockNativeWindSet).toHaveBeenLastCalledWith('system');
  });

  it('prefers a stored explicit theme over the device scheme', async () => {
    mockGetItemAsync.mockResolvedValue('light');

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mode').props.children).toBe('light');
      expect(screen.getByTestId('scheme').props.children).toBe('light');
      expect(screen.getByTestId('is-dark').props.children).toBe('false');
    });

    expect(mockNativeWindSet).toHaveBeenLastCalledWith('light');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
