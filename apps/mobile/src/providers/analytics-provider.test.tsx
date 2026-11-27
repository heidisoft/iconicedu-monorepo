import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// usePostHog must be jest.fn() inside the factory — outer variables are not yet
// initialised when jest.mock factories run (hoisted above all imports).
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePostHog: jest.fn(),
  PostHog: jest.fn(),
}));

// Provide a key so the module-level POSTHOG_KEY constant is non-empty on import.
// __esModule: true prevents interopRequireDefault from double-wrapping the default export.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { posthogKey: 'ph_test_key' } } },
}));

import { PostHog, usePostHog } from 'posthog-react-native';
import {
  AnalyticsProvider,
  hasPostHogNativeReplayModule,
  useAnalytics,
} from './analytics-provider';
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

  it('uses the development project only for flags and keeps analytics on its original client', () => {
    process.env.EXPO_PUBLIC_POSTHOG_FLAGS_KEY = 'phc_development_flags';
    process.env.EXPO_PUBLIC_POSTHOG_FLAGS_HOST = 'https://flags.example.com';
    const flagClient = { identify: jest.fn(), reset: jest.fn(), shutdown: jest.fn() };
    (PostHog as unknown as jest.Mock).mockImplementation(() => flagClient);
    try {
      const view = renderWrapped();
      const [key, options] = (PostHog as unknown as jest.Mock).mock.calls[0];
      expect(key).toBe('phc_development_flags');
      expect(options).toMatchObject({
        host: 'https://flags.example.com',
        persistence: 'memory',
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        errorTracking: { autocapture: false },
      });
      expect(options.before_send({ event: 'analytics_event' })).toBeNull();
      screen.getByTestId('result').props.onPress();
      expect(mockPh.capture).toHaveBeenCalledWith('test_event', undefined);
      expect(flagClient.identify).toHaveBeenCalledWith('user_1', undefined);
      expect(flagClient.reset).toHaveBeenCalled();
      view.unmount();
      expect(flagClient.shutdown).toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_POSTHOG_FLAGS_KEY;
      delete process.env.EXPO_PUBLIC_POSTHOG_FLAGS_HOST;
    }
  });

  it('ignores the development flag project in release builds', () => {
    process.env.EXPO_PUBLIC_POSTHOG_FLAGS_KEY = 'phc_development_flags';
    const development = jest.replaceProperty(globalThis, '__DEV__', false);
    try {
      renderWrapped();
      expect(PostHog).not.toHaveBeenCalled();
      screen.getByTestId('result').props.onPress();
      expect(mockPh.capture).toHaveBeenCalledWith('test_event', undefined);
    } finally {
      development.restore();
      delete process.env.EXPO_PUBLIC_POSTHOG_FLAGS_KEY;
    }
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

describe('hasPostHogNativeReplayModule', () => {
  it('detects the current PostHog native plugin module', () => {
    expect(
      hasPostHogNativeReplayModule({
        PosthogReactNativePlugin: {},
      }),
    ).toBe(true);
  });

  it('keeps the legacy replay module fallback for existing native builds', () => {
    expect(
      hasPostHogNativeReplayModule({
        PosthogReactNativeSessionReplay: {},
      }),
    ).toBe(true);
  });

  it('returns false when no native replay module is linked', () => {
    expect(hasPostHogNativeReplayModule({})).toBe(false);
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
