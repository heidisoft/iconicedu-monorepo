/* @vitest-environment jsdom */
import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsPageClient } from './notifications-page-client';

const refresh = vi.fn();
const channelOn = vi.fn();
const channelSubscribe = vi.fn();
const channelUnsubscribe = vi.fn();
const channelMock = {
  on: channelOn,
  subscribe: channelSubscribe,
  unsubscribe: channelUnsubscribe,
};
const supabaseChannel = vi.fn(() => channelMock);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => '/iconic-academy/notifications',
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    channel: supabaseChannel,
  }),
}));

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: ({ title }: { title: string }) => <div>{title}</div>,
  InboxContainer: ({ feed }: { feed: unknown }) => (
    <div data-testid="notifications-container">{JSON.stringify(feed)}</div>
  ),
}));

describe('NotificationsPageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('subscribes to notification-related realtime tables and cleans up on unmount', () => {
    const { unmount } = render(
      <NotificationsPageClient
        orgId="org-1"
        orgSlug="iconic-academy"
        profileId="profile-1"
        feed={{
          activeTab: 'all',
          tabs: [],
          sections: [],
          unreadCount: 0,
          nextCursor: null,
        }}
      />,
    );

    expect(supabaseChannel).toHaveBeenCalledWith('inbox:org-1:profile-1');
    expect(channelOn).toHaveBeenCalledTimes(2);
    expect(channelSubscribe).toHaveBeenCalled();

    unmount();

    expect(channelUnsubscribe).toHaveBeenCalled();
  });

  it('debounces realtime-triggered router refreshes', () => {
    render(
      <NotificationsPageClient
        orgId="org-1"
        orgSlug="iconic-academy"
        profileId="profile-1"
        feed={{
          activeTab: 'all',
          tabs: [],
          sections: [],
          unreadCount: 0,
          nextCursor: null,
        }}
      />,
    );

    const realtimeCallbacks = channelOn.mock.calls.map((call) => call[2]);

    act(() => {
      realtimeCallbacks[0]?.();
      realtimeCallbacks[1]?.();
      vi.advanceTimersByTime(119);
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on focus and visible tab resume', () => {
    render(
      <NotificationsPageClient
        orgId="org-1"
        orgSlug="iconic-academy"
        profileId="profile-1"
        feed={{
          activeTab: 'all',
          tabs: [],
          sections: [],
          unreadCount: 0,
          nextCursor: null,
        }}
      />,
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(120);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(120);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
