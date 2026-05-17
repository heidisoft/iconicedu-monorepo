import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockNativeWindSet = jest.fn();
let mockNativeWindScheme: 'light' | 'dark' = 'dark';
let mockNativeWindMode: 'light' | 'dark' | 'system' = 'system';
let mockNativeWindListeners: Array<() => void> = [];

function mockNotifyNativeWind() {
  mockNativeWindListeners.forEach((listener) => listener());
}

function mockSetSystemScheme(scheme: 'light' | 'dark') {
  mockNativeWindScheme = scheme;
  if (mockNativeWindMode === 'system') {
    mockNotifyNativeWind();
  }
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

jest.mock('react-native-css-interop', () => ({
  useColorScheme: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const colorScheme = React.useSyncExternalStore(
      (listener: () => void) => {
        mockNativeWindListeners.push(listener);
        return () => {
          mockNativeWindListeners = mockNativeWindListeners.filter(
            (entry) => entry !== listener,
          );
        };
      },
      () => mockNativeWindScheme,
      () => mockNativeWindScheme,
    );

    return {
      colorScheme,
      setColorScheme: (mode: 'light' | 'dark' | 'system') => {
        mockNativeWindMode = mode;
        mockNativeWindSet(mode);
        if (mode === 'light' || mode === 'dark') {
          mockNativeWindScheme = mode;
          mockNotifyNativeWind();
        }
      },
      toggleColorScheme: jest.fn(),
    };
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
    mockNativeWindScheme = 'dark';
    mockNativeWindMode = 'system';
    mockNativeWindListeners = [];
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
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
    mockNativeWindScheme = 'light';

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
      mockSetSystemScheme('dark');
    });

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

  it('ignores OS appearance changes when a stored explicit theme is selected', async () => {
    mockGetItemAsync.mockResolvedValue('light');
    mockNativeWindScheme = 'dark';

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

    act(() => {
      mockSetSystemScheme('dark');
    });

    expect(screen.getByTestId('scheme').props.children).toBe('light');
    expect(screen.getByTestId('is-dark').props.children).toBe('false');
    expect(mockNativeWindSet).toHaveBeenLastCalledWith('light');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
