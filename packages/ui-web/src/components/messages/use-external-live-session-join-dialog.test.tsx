import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  copyExternalLiveSessionJoinLink,
  ExternalLiveSessionJoinDialog,
} from './external-live-session-join-dialog';
import { LiveSessionJoinContext } from './live-session-join-context';
import { useExternalLiveSessionJoinDialog } from './use-external-live-session-join-dialog';

describe('useExternalLiveSessionJoinDialog', () => {
  const originalClipboard = navigator.clipboard;
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('loads passcodes for URL-only join dialogs through the authenticated app resolver', async () => {
    const resolveLink = vi.fn().mockResolvedValue({
      joinPath: 'https://app.invalid/live/a3f8-b2d4-c9e1',
      provider: 'zoom',
      passcode: 'test-secret',
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LiveSessionJoinContext.Provider value={{ resolveLink, joinChannel: vi.fn() }}>
        {children}
      </LiveSessionJoinContext.Provider>
    );
    const { result } = renderHook(() => useExternalLiveSessionJoinDialog(), { wrapper });
    await act(async () => result.current.handleResolvedJoinHref('/live/a3f8-b2d4-c9e1'));
    expect(result.current.externalJoinTarget).toMatchObject({
      passcode: 'test-secret',
      copyHref: 'https://app.invalid/live/a3f8-b2d4-c9e1',
    });
    expect(resolveLink).toHaveBeenCalledWith('/live/a3f8-b2d4-c9e1');
  });
  it('uses the invitation for both copying and opening while preserving the return path', async () => {
    const invitation = 'https://app.invalid/live/a3f8-b2d4-c9e1#invite=synthetic-token';
    const resolveLink = vi.fn().mockResolvedValue({
      joinPath: 'https://app.invalid/live/a3f8-b2d4-c9e1',
      sharePath: invitation,
      passcode: 'test-secret',
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LiveSessionJoinContext.Provider value={{ resolveLink, joinChannel: vi.fn() }}>
        {children}
      </LiveSessionJoinContext.Provider>
    );
    const { result } = renderHook(() => useExternalLiveSessionJoinDialog(), { wrapper });
    await act(async () =>
      result.current.openExternalJoinDialog(
        'https://app.invalid/live/a3f8-b2d4-c9e1?returnTo=%2Fhome',
        'zoom',
        { isInternal: true },
      ),
    );
    expect(result.current.externalJoinTarget).toMatchObject({
      joinHref:
        'https://app.invalid/live/a3f8-b2d4-c9e1?returnTo=%2Fhome#invite=synthetic-token',
      copyHref: invitation,
      linkLoading: false,
    });
  });
  it('routes internal join hrefs through the provided navigator', () => {
    const onInternalJoinHref = vi.fn();
    const { result } = renderHook(() =>
      useExternalLiveSessionJoinDialog({ onInternalJoinHref }),
    );

    result.current.handleResolvedJoinHref('/iconic-academy/live-sessions/123');

    expect(onInternalJoinHref).toHaveBeenCalledWith('/iconic-academy/live-sessions/123');
    expect(result.current.externalJoinTarget).toBeNull();
  });

  it('opens dialog state for external join hrefs and resolves provider labels', () => {
    const { result } = renderHook(() => useExternalLiveSessionJoinDialog());

    act(() => {
      result.current.handleResolvedJoinHref('https://zoom.us/j/123');
    });

    expect(result.current.externalJoinTarget).toEqual({
      joinHref: 'https://zoom.us/j/123',
      providerLabel: 'Zoom',
    });
  });

  it('labels an own-domain join link using the provider hint, not the hostname', () => {
    const { result } = renderHook(() => useExternalLiveSessionJoinDialog());

    act(() => {
      result.current.handleResolvedJoinHref(
        'https://app.iconicedu.lk/live/session-1',
        'zoom',
      );
    });

    expect(result.current.externalJoinTarget).toEqual({
      joinHref: 'https://app.iconicedu.lk/live/session-1',
      providerLabel: 'Zoom',
    });
  });

  it('copies the external join link from the dialog', async () => {
    const user = userEvent.setup();

    render(
      <ExternalLiveSessionJoinDialog
        target={{
          joinHref: 'https://zoom.us/j/123',
          providerLabel: 'Zoom',
        }}
        onOpenChange={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Zoom/i })).toHaveAttribute(
      'href',
      'https://zoom.us/j/123',
    );
  });

  it('passes the join url to the clipboard helper', async () => {
    await copyExternalLiveSessionJoinLink('https://zoom.us/j/123', {
      writeText: writeTextMock,
    });

    expect(writeTextMock).toHaveBeenCalledWith('https://zoom.us/j/123');
  });
});
