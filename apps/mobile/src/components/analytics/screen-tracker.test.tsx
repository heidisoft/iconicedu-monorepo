import React from 'react';
import { render } from '@testing-library/react-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockScreen = jest.fn();
const mockCapture = jest.fn();

jest.mock('@/providers/analytics-provider', () => ({
  useAnalytics: () => ({
    screen: mockScreen,
    capture: mockCapture,
    identify: jest.fn(),
    reset: jest.fn(),
  }),
}));

let mockPathname = '/(app)/(tabs)';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

import { ScreenTracker } from './screen-tracker';
import { AnalyticsEvent } from '@iconicedu/utils';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScreenTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/(app)/(tabs)';
  });

  it('renders null (no visible output)', () => {
    const { toJSON } = render(<ScreenTracker />);
    expect(toJSON()).toBeNull();
  });

  it('calls analytics.screen with a human-readable name on mount', () => {
    render(<ScreenTracker />);
    expect(mockScreen).toHaveBeenCalledWith('Home');
  });

  it('calls analytics.capture with SCREEN_VIEWED on mount', () => {
    render(<ScreenTracker />);
    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: 'Home',
      screen_path: '/(app)/(tabs)',
    });
  });

  it('does not include previous_screen on first render', () => {
    render(<ScreenTracker />);
    const call = mockCapture.mock.calls[0][1] as Record<string, unknown>;
    expect(call.previous_screen).toBeUndefined();
  });

  it('maps Expo Router paths to readable names', () => {
    mockPathname = '/(app)/(tabs)/schedule';
    render(<ScreenTracker />);
    expect(mockScreen).toHaveBeenCalledWith('Schedule');
    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: 'Schedule',
      screen_path: '/(app)/(tabs)/schedule',
    });
  });

  it('includes previous_screen after navigating from first screen', () => {
    const { rerender } = render(<ScreenTracker />);
    jest.clearAllMocks();

    mockPathname = '/(app)/(tabs)/schedule';
    rerender(<ScreenTracker />);

    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: 'Schedule',
      screen_path: '/(app)/(tabs)/schedule',
      previous_screen: 'Home',
    });
  });

  it('fires both screen() and capture() on every navigation', () => {
    const { rerender } = render(<ScreenTracker />);
    mockPathname = '/(app)/(tabs)/messages';
    rerender(<ScreenTracker />);

    expect(mockScreen).toHaveBeenLastCalledWith('Messages');
    expect(mockCapture).toHaveBeenLastCalledWith(
      AnalyticsEvent.SCREEN_VIEWED,
      expect.objectContaining({ screen_name: 'Messages' }),
    );
  });
});
