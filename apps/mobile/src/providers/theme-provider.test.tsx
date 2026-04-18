import React from 'react';
import { Appearance, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockAppearanceGetColorScheme = jest.fn();
const mockAppearanceRemove = jest.fn();
const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockNativeWindSet = jest.fn();
let appearanceChangeListener:
  | ((event: { colorScheme: 'light' | 'dark' | null }) => void)
  | null = null;

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

jest.mock('react-native-css-interop', () => ({
  colorScheme: {
    set: (...args: unknown[]) => mockNativeWindSet(...args),
  },
}));

import { ThemeProvider, useTheme } from './theme-provider';

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
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
    mockAppearanceGetColorScheme.mockReturnValue('dark');
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

    expect(mockNativeWindSet).toHaveBeenCalledWith('dark');
  });

  it('updates when the OS appearance changes while following system mode', async () => {
    mockAppearanceGetColorScheme.mockReturnValue('light');

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('scheme').props.children).toBe('light');
      expect(screen.getByTestId('is-dark').props.children).toBe('false');
    });

    act(() => {
      appearanceChangeListener?.({ colorScheme: 'dark' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('scheme').props.children).toBe('dark');
      expect(screen.getByTestId('is-dark').props.children).toBe('true');
    });

    expect(mockNativeWindSet).toHaveBeenLastCalledWith('dark');
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
    appearanceChangeListener = null;
    jest.restoreAllMocks();
  });
});
