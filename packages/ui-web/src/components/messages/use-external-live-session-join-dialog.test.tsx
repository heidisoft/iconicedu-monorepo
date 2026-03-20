import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  copyExternalLiveSessionJoinLink,
  ExternalLiveSessionJoinDialog,
} from './external-live-session-join-dialog';
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
