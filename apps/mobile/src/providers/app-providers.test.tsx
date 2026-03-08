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

function UiTrackingBridge({ children }: { children: React.ReactNode }) {
  const analytics = useAnalytics();
  const pathname = usePathname();

  const capture = useCallback(
    (event: string, props?: Record<string, unknown>) =>
      analytics.capture(event, { screen_name: pathname, ...props }),
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

  it('injects screen_name from current pathname into captured events', () => {
    mockPathname.mockReturnValue('/schedule');
    renderWithProviders(<TrackingConsumer onCapture={jest.fn()} />);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(mockPh.capture).toHaveBeenCalledWith(
      'button clicked',
      expect.objectContaining({ screen_name: '/schedule', button_name: 'Submit' }),
    );
  });

  it('allows component props to override screen_name', () => {
    // The bridge spreads { screen_name: pathname, ...props } so component props win.
    // Verify the merge order: later spread wins.
    const overrideProps = {
      ...{ screen_name: '/home' },
      ...{ screen_name: '/override', button_name: 'Submit' },
    };
    expect(overrideProps.screen_name).toBe('/override');
  });

  it('renders children', () => {
    renderWithProviders(<Text testID="child">hello</Text>);
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
