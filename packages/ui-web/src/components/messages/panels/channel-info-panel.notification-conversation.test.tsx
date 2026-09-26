/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { NotificationConversationSection } from './channel-info-panel';

function mockFetchSequence(handlers: {
  get?: () => { success: boolean; data?: { mode: string; mutedUntil: string | null } };
  post?: (body: unknown) => { success: boolean };
}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (!init || init.method === undefined) {
      const payload = handlers.get?.() ?? {
        success: true,
        data: { mode: 'normal', mutedUntil: null },
      };
      return { ok: true, json: async () => payload };
    }
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const payload = handlers.post?.(body) ?? { success: true };
    return { ok: payload.success !== false, json: async () => payload };
  });
}

describe('NotificationConversationSection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads and reflects the current mode on mount', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence({
        get: () => ({ success: true, data: { mode: 'mentions_only', mutedUntil: null } }),
      }),
    );

    render(<NotificationConversationSection channelId="channel-1" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notification-preferences/conversation-mode?scopeKind=channel&scopeId=channel-1',
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mentions only' })).toHaveClass(
        'border-primary/60',
      );
    });
  });

  it('saves the selected mode via the conversation-mode proxy route', async () => {
    const postSpy = vi.fn(() => ({ success: true }));
    vi.stubGlobal(
      'fetch',
      mockFetchSequence({
        get: () => ({ success: true, data: { mode: 'normal', mutedUntil: null } }),
        post: postSpy,
      }),
    );

    render(<NotificationConversationSection channelId="channel-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Normal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mentions only' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith({
        scopeKind: 'channel',
        scopeId: 'channel-1',
        mode: 'mentions_only',
        mutedUntil: null,
      });
    });
  });

  it('mutes for a preset duration and computes mutedUntil client-side', async () => {
    const postSpy = vi.fn(() => ({ success: true }));
    vi.stubGlobal(
      'fetch',
      mockFetchSequence({
        get: () => ({ success: true, data: { mode: 'normal', mutedUntil: null } }),
        post: postSpy,
      }),
    );

    render(<NotificationConversationSection channelId="channel-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Normal' }));

    const beforeClickMs = Date.now();
    fireEvent.click(screen.getByRole('button', { name: '1 hour' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeKind: 'channel',
          scopeId: 'channel-1',
          mode: 'muted_until',
        }),
      );
    });

    const [call] = postSpy.mock.calls[0] as [{ mutedUntil: string }];
    const mutedUntilMs = new Date(call.mutedUntil).getTime();
    // Should be ~1 hour from when the button was clicked, allowing generous slack for
    // test-runner scheduling jitter.
    expect(mutedUntilMs).toBeGreaterThanOrEqual(beforeClickMs + 60 * 60 * 1000 - 5000);
    expect(mutedUntilMs).toBeLessThanOrEqual(beforeClickMs + 60 * 60 * 1000 + 5000);
  });

  it('shows an unmute action once muted, and posts mode "normal" when clicked', async () => {
    const postSpy = vi.fn(() => ({ success: true }));
    vi.stubGlobal(
      'fetch',
      mockFetchSequence({
        get: () => ({
          success: true,
          data: { mode: 'muted_until_enabled', mutedUntil: null },
        }),
        post: postSpy,
      }),
    );

    render(<NotificationConversationSection channelId="channel-1" />);

    const unmuteButton = await screen.findByRole('button', {
      name: 'Turn on notifications',
    });
    fireEvent.click(unmuteButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith({
        scopeKind: 'channel',
        scopeId: 'channel-1',
        mode: 'normal',
        mutedUntil: null,
      });
    });
  });

  it('rolls back the optimistic mode change when the save request fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence({
        get: () => ({ success: true, data: { mode: 'normal', mutedUntil: null } }),
        post: () => ({ success: false }),
      }),
    );

    render(<NotificationConversationSection channelId="channel-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Normal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mentions only' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Normal' })).toHaveClass(
        'border-primary/60',
      );
    });
  });
});
