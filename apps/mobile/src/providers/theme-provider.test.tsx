import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
let mockSystemScheme: 'light' | 'dark' = 'dark';
let mockSystemListeners: Array<() => void> = [];

function mockSetSystemScheme(scheme: 'light' | 'dark') {
  mockSystemScheme = scheme;
  mockSystemListeners.forEach((listener) => listener());
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  const MockReactNative = Object.create(ReactNative) as typeof ReactNative;
  const useMockColorScheme = () =>
    React.useSyncExternalStore(
      (listener: () => void) => {
        mockSystemListeners.push(listener);
        return () => {
          mockSystemListeners = mockSystemListeners.filter((entry) => entry !== listener);
        };
      },
      () => mockSystemScheme,
      () => mockSystemScheme,
    );

  Object.defineProperty(MockReactNative, 'useColorScheme', {
    value: useMockColorScheme,
  });

  return MockReactNative;
});

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
    mockSystemScheme = 'dark';
    mockSystemListeners = [];
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  it('uses the device dark scheme in system mode', async () => {
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
  });

  it('updates when the OS appearance changes while following system mode', async () => {
    mockSystemScheme = 'light';

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
  });

  it('ignores OS appearance changes when a stored explicit theme is selected', async () => {
    mockGetItemAsync.mockResolvedValue('light');
    mockSystemScheme = 'dark';

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
