import React from 'react';
import { Text, useColorScheme } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockNativeWindSet = jest.fn();

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
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
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

    mockUseColorScheme.mockReturnValue('dark');
    view.rerender(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('scheme').props.children).toBe('dark');
      expect(screen.getByTestId('is-dark').props.children).toBe('true');
    });

    expect(mockNativeWindSet).toHaveBeenCalledWith('system');
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
