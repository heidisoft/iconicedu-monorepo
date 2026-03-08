import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { AnalyticsEvent } from '@iconicedu/utils';

const mockCapture = jest.fn();
const mockFlush = jest.fn();

jest.mock('@/providers/analytics-provider', () => ({
  useAnalytics: () => ({
    screen: jest.fn(),
    capture: mockCapture,
    identify: jest.fn(),
    reset: jest.fn(),
    flush: mockFlush,
  }),
}));

import { AppLifecycleTracker } from './app-lifecycle-tracker';

describe('AppLifecycleTracker', () => {
  let changeListener: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    changeListener = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, handler: (state: AppStateStatus) => void) => {
        changeListener = handler;
        return { remove: jest.fn() };
      });
    // Start in a known state
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
    });
  });

  it('renders null (no visible output)', () => {
    const { toJSON } = render(<AppLifecycleTracker />);
    expect(toJSON()).toBeNull();
  });

  it('registers an AppState change listener on mount', () => {
    render(<AppLifecycleTracker />);
    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('fires APP_FOREGROUNDED when transitioning from background to active', () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
    });
    render(<AppLifecycleTracker />);

    act(() => {
      changeListener?.('active');
    });

    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.APP_FOREGROUNDED);
  });

  it('fires APP_BACKGROUNDED and flushes when transitioning to background', () => {
    render(<AppLifecycleTracker />);

    act(() => {
      changeListener?.('background');
    });

    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.APP_BACKGROUNDED, {
      state: 'background',
    });
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('fires APP_BACKGROUNDED and flushes when transitioning to inactive', () => {
    render(<AppLifecycleTracker />);

    act(() => {
      changeListener?.('inactive');
    });

    expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvent.APP_BACKGROUNDED, {
      state: 'inactive',
    });
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('does not flush when foregrounding', () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
    });
    render(<AppLifecycleTracker />);

    act(() => {
      changeListener?.('active');
    });

    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('does not fire when staying active', () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
    });
    render(<AppLifecycleTracker />);

    act(() => {
      changeListener?.('active');
    });

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });

    const { unmount } = render(<AppLifecycleTracker />);
    unmount();

    expect(remove).toHaveBeenCalled();
  });
});
