import React from 'react';
import { render } from '@testing-library/react-native';

const mockScreen = jest.fn();

jest.mock('@/providers/analytics-provider', () => ({
  useAnalytics: () => ({
    screen: mockScreen,
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  }),
}));

let mockPathname = '/home';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

import { ScreenTracker } from './screen-tracker';

describe('ScreenTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/home';
  });

  it('calls analytics.screen with the current pathname on mount', () => {
    render(<ScreenTracker />);
    expect(mockScreen).toHaveBeenCalledWith('/home');
  });

  it('calls analytics.screen with each unique pathname', () => {
    mockPathname = '/schedule';
    render(<ScreenTracker />);
    expect(mockScreen).toHaveBeenCalledWith('/schedule');

    jest.clearAllMocks();

    mockPathname = '/messages';
    render(<ScreenTracker />);
    expect(mockScreen).toHaveBeenCalledWith('/messages');
  });

  it('renders null (no visible output)', () => {
    const { toJSON } = render(<ScreenTracker />);
    expect(toJSON()).toBeNull();
  });
});
