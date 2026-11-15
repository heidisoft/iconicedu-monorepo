import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeMeetingDeviceRecovery } from './browser-device-recovery';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('meeting device recovery', () => {
  it('coalesces foreground, network and device events and removes listeners', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const devices = new EventTarget();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: devices,
    });
    const stop = subscribeMeetingDeviceRecovery(refresh);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
    devices.dispatchEvent(new Event('devicechange'));
    vi.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new Event('online'));
    devices.dispatchEvent(new Event('devicechange'));
    vi.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does not touch devices while the browser is hidden', () => {
    vi.useFakeTimers();
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    const refresh = vi.fn();
    const stop = subscribeMeetingDeviceRecovery(refresh);
    window.dispatchEvent(new Event('online'));
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.runAllTimers();
    expect(refresh).not.toHaveBeenCalled();
    stop();
  });
  it('cancels a queued refresh when the meeting unmounts', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const stop = subscribeMeetingDeviceRecovery(refresh);
    window.dispatchEvent(new Event('online'));
    stop();
    vi.runAllTimers();
    expect(refresh).not.toHaveBeenCalled();
  });
});
