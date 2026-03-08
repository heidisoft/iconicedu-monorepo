import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// usePostHog must be jest.fn() inside the factory — outer variables are not yet
// initialised when jest.mock factories run (hoisted above all imports).
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePostHog: jest.fn(),
}));

// Provide a key so the module-level POSTHOG_KEY constant is non-empty on import.
// __esModule: true prevents interopRequireDefault from double-wrapping the default export.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { posthogKey: 'ph_test_key' } } },
}));

import { usePostHog } from 'posthog-react-native';
import { AnalyticsProvider, useAnalytics } from './analytics-provider';
import { createNoopAnalytics } from '@iconicedu/utils';

// ─── Shared PostHog stub (populated before each test) ────────────────────────

const mockPh = {
  capture: jest.fn(),
  identify: jest.fn(),
  screen: jest.fn(),
  reset: jest.fn(),
  flush: jest.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AnalyticsConsumer() {
  const analytics = useAnalytics();
  return (
    <Text
      testID="result"
      onPress={() => {
        analytics.capture('test_event');
        analytics.identify('user_1');
        analytics.screen('HomeScreen');
        analytics.reset();
        analytics.flush?.();
      }}
    >
      ready
    </Text>
  );
}

function renderWrapped() {
  return render(
    <AnalyticsProvider>
      <AnalyticsConsumer />
    </AnalyticsProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AnalyticsProvider / useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePostHog as jest.Mock).mockReturnValue(mockPh);
  });

  it('renders children', () => {
    renderWrapped();
    expect(screen.getByTestId('result').props.children).toBe('ready');
  });

  it('forwards capture to PostHog', () => {
    renderWrapped();
    screen.getByTestId('result').props.onPress();
    expect(mockPh.capture).toHaveBeenCalledWith('test_event', undefined);
  });

  it('forwards identify to PostHog', () => {
    renderWrapped();
    screen.getByTestId('result').props.onPress();
    expect(mockPh.identify).toHaveBeenCalledWith('user_1', undefined);
  });

  it('forwards screen to PostHog', () => {
    renderWrapped();
    screen.getByTestId('result').props.onPress();
    expect(mockPh.screen).toHaveBeenCalledWith('HomeScreen', undefined);
  });

  it('forwards reset to PostHog', () => {
    renderWrapped();
    screen.getByTestId('result').props.onPress();
    expect(mockPh.reset).toHaveBeenCalled();
  });

  it('forwards flush to PostHog', () => {
    renderWrapped();
    screen.getByTestId('result').props.onPress();
    expect(mockPh.flush).toHaveBeenCalled();
  });
});

// The noop path (no POSTHOG_KEY) uses createNoopAnalytics() directly.
// Test it in isolation without module-level constant manipulation.
describe('noop analytics client (fallback when no PostHog key)', () => {
  it('all methods are callable without errors', () => {
    const noop = createNoopAnalytics();
    expect(() => noop.capture('event')).not.toThrow();
    expect(() => noop.identify('user')).not.toThrow();
    expect(() => noop.screen('Screen')).not.toThrow();
    expect(() => noop.reset()).not.toThrow();
    expect(() => noop.flush?.()).not.toThrow();
  });
});
