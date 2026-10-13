import { act, render, screen, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusedFullscreenButton, useFocusedFullscreen } from './focused-fullscreen';

let target: HTMLDivElement;
let active: Element | null;
beforeEach(() => {
  target = document.createElement('div');
  document.body.append(target);
  active = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => active,
  });
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    value: true,
  });
  target.requestFullscreen = vi.fn(async () => {
    active = target;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  document.exitFullscreen = vi.fn(async () => {
    active = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
});
afterEach(() => {
  target.remove();
  vi.restoreAllMocks();
});
describe('focused content fullscreen', () => {
  it('requests fullscreen on the same media node and tracks exiting', async () => {
    const { result } = renderHook(() => useFocusedFullscreen());
    const canvas = document.createElement('canvas');
    target.append(canvas);
    act(() => result.current.setTarget(target));
    await act(() => result.current.toggle());
    expect(target.requestFullscreen).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(true);
    expect(target.firstChild).toBe(canvas);
    await act(() => result.current.toggle());
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
  });
  it('tracks browser Escape and exits when shared content ends', async () => {
    const { result, rerender } = renderHook((visible) => useFocusedFullscreen(visible), {
      initialProps: true,
    });
    act(() => result.current.setTarget(target));
    await act(() => result.current.toggle());
    act(() => {
      active = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.active).toBe(false);
    await act(() => result.current.toggle());
    rerender(false);
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
  });
  it('keeps content in place and exposes a denied request', async () => {
    target.requestFullscreen = vi
      .fn()
      .mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const { result } = renderHook(() => useFocusedFullscreen());
    act(() => result.current.setTarget(target));
    await act(() => result.current.toggle());
    expect(result.current.active).toBe(false);
    expect(result.current.error).toMatch(/main call/);
    expect(target.parentElement).toBe(document.body);
  });
});

it.each([false, true])(
  'keeps the fullscreen control at the bottom when active=%s',
  (active) => {
    render(
      <FocusedFullscreenButton
        label="whiteboard"
        fullscreen={{
          setTarget: vi.fn(),
          active,
          supported: true,
          toggle: vi.fn(),
          error: null,
          dismissError: vi.fn(),
        }}
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('bottom-3');
    expect(screen.getByRole('button')).not.toHaveClass('top-3');
  },
);
