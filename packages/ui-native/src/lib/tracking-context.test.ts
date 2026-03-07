import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import {
  UiTrackingContext,
  useUiTracking,
  type UiTrackCapture,
} from './tracking-context';

describe('UiTrackingContext', () => {
  it('provides a noop by default (no error thrown)', () => {
    const { result } = renderHook(() => useUiTracking());
    expect(() =>
      act(() => result.current('button_clicked', { label: 'test' })),
    ).not.toThrow();
  });

  it('returns the injected capture function when a provider is present', () => {
    const capture = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(UiTrackingContext.Provider, { value: capture }, children);

    const { result } = renderHook(() => useUiTracking(), { wrapper });
    act(() => result.current('button_clicked', { label: 'Submit' }));

    expect(capture).toHaveBeenCalledWith('button_clicked', { label: 'Submit' });
  });

  it('capture is called with the exact event and props passed', () => {
    const capture: UiTrackCapture = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(UiTrackingContext.Provider, { value: capture }, children);

    const { result } = renderHook(() => useUiTracking(), { wrapper });
    act(() => result.current('custom_event', { foo: 'bar', count: 42 }));

    expect(capture).toHaveBeenCalledWith('custom_event', { foo: 'bar', count: 42 });
  });

  it('works with no props argument', () => {
    const capture = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(UiTrackingContext.Provider, { value: capture }, children);

    const { result } = renderHook(() => useUiTracking(), { wrapper });
    act(() => result.current('page_viewed'));

    expect(capture).toHaveBeenCalledWith('page_viewed', undefined);
  });
});
