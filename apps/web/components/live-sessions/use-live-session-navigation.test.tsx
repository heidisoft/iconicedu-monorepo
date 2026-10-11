import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveSessionNavigation } from './use-live-session-navigation';
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

describe('live session navigation from app pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/academy/messages?channel=demo');
  });
  it('opens the ready-to-join dialog for app-hosted Zoom and captures the source', () => {
    const { result } = renderHook(() => useLiveSessionNavigation());
    act(() =>
      result.current.handleResolvedJoinHref(
        `${window.location.origin}/live/demo?passcode=class`,
        'zoom',
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.externalJoinTarget).toMatchObject({
      isInternal: true,
      providerLabel: 'Zoom',
    });
    const href = new URL(result.current.externalJoinTarget!.joinHref);
    expect(href.pathname).toBe('/live/demo');
    expect(href.searchParams.get('returnTo')).toBe('/academy/messages?channel=demo');
    expect(href.searchParams.get('passcode')).toBe('class');
    const copied = new URL(result.current.externalJoinTarget!.copyHref!);
    expect(copied.searchParams.has('returnTo')).toBe(false);
    expect(copied.searchParams.get('passcode')).toBe('class');
  });
  it('continues to show the external provider dialog without navigating', () => {
    const { result } = renderHook(() => useLiveSessionNavigation());
    act(() => result.current.handleResolvedJoinHref('https://zoom.us/j/123', 'zoom'));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.externalJoinTarget).toMatchObject({
      joinHref: 'https://zoom.us/j/123',
    });
  });
  it('also opens the dialog for relative Zoom URLs and supports cancelling', () => {
    const { result } = renderHook(() => useLiveSessionNavigation());
    act(() => result.current.handleResolvedJoinHref('/live/demo?passcode=class'));
    expect(result.current.externalJoinTarget).toMatchObject({
      isInternal: true,
      providerLabel: 'Zoom',
    });
    act(() => result.current.closeExternalJoinDialog());
    expect(result.current.externalJoinTarget).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('continues to navigate to other internal app routes', () => {
    const { result } = renderHook(() => useLiveSessionNavigation());
    act(() => result.current.handleResolvedJoinHref('/academy/live-sessions/demo'));
    expect(mocks.push).toHaveBeenCalledWith('/academy/live-sessions/demo');
    expect(result.current.externalJoinTarget).toBeNull();
  });
});
