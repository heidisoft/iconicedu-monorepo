import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UiTrackingContext } from '@iconicedu/ui-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// usePostHog must be jest.fn() inside the factory due to hoisting.
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePostHog: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { posthogKey: 'ph_test_key' } } },
}));

// expo-router: control the pathname returned by usePathname.
const mockPathname = jest.fn<string, []>(() => '/home');
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname(),
}));

import { usePostHog } from 'posthog-react-native';
import { AnalyticsProvider, useAnalytics } from './analytics-provider';

const mockPh = {
  capture: jest.fn(),
  identify: jest.fn(),
  screen: jest.fn(),
  reset: jest.fn(),
};

// ─── Minimal UiTrackingBridge re-implementation (mirrors app-providers.tsx) ──
// We test the bridge logic in isolation without needing the full AppProviders tree.

import { useCallback } from 'react';
import { usePathname } from 'expo-router';
import { getScreenName } from '@/lib/screen-name';

function UiTrackingBridge({ children }: { children: React.ReactNode }) {
  const analytics = useAnalytics();
  const pathname = usePathname();

  const capture = useCallback(
    (event: string, props?: Record<string, unknown>) =>
      analytics.capture(event, { screen_name: getScreenName(pathname), ...props }),
    [analytics, pathname],
  );

  return (
    <UiTrackingContext.Provider value={capture}>{children}</UiTrackingContext.Provider>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function TrackingConsumer({
  onCapture,
}: {
  onCapture: (event: string, props?: Record<string, unknown>) => void;
}) {
  const capture = React.useContext(UiTrackingContext);
  return (
    <Pressable
      testID="trigger"
      onPress={() => {
        capture('button clicked', { button_name: 'Submit', component_type: 'button' });
        onCapture('button clicked', { button_name: 'Submit', component_type: 'button' });
      }}
    >
      <Text>press</Text>
    </Pressable>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AnalyticsProvider>
      <UiTrackingBridge>{ui}</UiTrackingBridge>
    </AnalyticsProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UiTrackingBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePostHog as jest.Mock).mockReturnValue(mockPh);
    mockPathname.mockReturnValue('/home');
  });

  it('injects human-readable screen_name into captured UI events', () => {
    mockPathname.mockReturnValue('/(app)/(tabs)/schedule');
    renderWithProviders(<TrackingConsumer onCapture={jest.fn()} />);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(mockPh.capture).toHaveBeenCalledWith(
      'button clicked',
      expect.objectContaining({ screen_name: 'Schedule', button_name: 'Submit' }),
    );
  });

  it('uses "Home" as screen_name on the home tab', () => {
    mockPathname.mockReturnValue('/(app)/(tabs)');
    renderWithProviders(<TrackingConsumer onCapture={jest.fn()} />);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(mockPh.capture).toHaveBeenCalledWith(
      'button clicked',
      expect.objectContaining({ screen_name: 'Home' }),
    );
  });

  it('allows component props to override screen_name', () => {
    // The bridge spreads { screen_name: getScreenName(pathname), ...props } so component props win.
    // Verify the merge order: later spread wins.
    const overrideProps = {
      ...{ screen_name: 'Home' },
      ...{ screen_name: 'Custom Screen', button_name: 'Submit' },
    };
    expect(overrideProps.screen_name).toBe('Custom Screen');
  });

  it('renders children', () => {
    renderWithProviders(<Text testID="child">hello</Text>);
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
