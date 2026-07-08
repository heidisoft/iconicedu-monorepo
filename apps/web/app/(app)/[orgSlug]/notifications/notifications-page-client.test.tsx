/* @vitest-environment jsdom */
import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsPageClient } from './notifications-page-client';

const { inboxContainerMock, listSessionChangeRequestsActionMock } = vi.hoisted(() => ({
  inboxContainerMock: vi.fn(
    ({
      feed,
      showMarkAllAsRead,
      pendingSessionChangeRequestIds,
      currentProfileId,
    }: {
      feed: unknown;
      showMarkAllAsRead?: boolean;
      pendingSessionChangeRequestIds?: Set<string>;
      currentProfileId?: string | null;
    }) => (
      <div
        data-testid="notifications-container"
        data-mark-all={String(showMarkAllAsRead)}
        data-profile-id={currentProfileId ?? ''}
        data-pending-requests={Array.from(pendingSessionChangeRequestIds ?? []).join(',')}
      >
        {JSON.stringify(feed)}
      </div>
    ),
  ),
  listSessionChangeRequestsActionMock: vi.fn(),
}));

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
  InboxContainer: inboxContainerMock,
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@iconicedu/web/app/actions/self-serve-class-session-change', () => ({
  approveSessionChangeRequestAction: vi.fn(),
  rejectSessionChangeRequestAction: vi.fn(),
  listSessionChangeRequestsAction: (...args: unknown[]) =>
    listSessionChangeRequestsActionMock(...args),
}));

describe('NotificationsPageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    listSessionChangeRequestsActionMock.mockResolvedValue([]);
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
    expect(channelOn).toHaveBeenCalledTimes(1);
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

  it('enables mark all as read on the notifications inbox', () => {
    const { getByTestId } = render(
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

    expect(inboxContainerMock).toHaveBeenCalled();
    expect(getByTestId('notifications-container')).toHaveAttribute(
      'data-mark-all',
      'true',
    );
  });

  it('passes pending session change request ids to the inbox', async () => {
    listSessionChangeRequestsActionMock.mockResolvedValue([
      {
        id: 'request-1',
        status: 'pending',
      },
      {
        id: 'request-2',
        status: 'approved',
      },
    ]);

    const { getByTestId } = render(
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

    await act(async () => {});

    expect(getByTestId('notifications-container')).toHaveAttribute(
      'data-pending-requests',
      'request-1',
    );
    expect(getByTestId('notifications-container')).toHaveAttribute(
      'data-profile-id',
      'profile-1',
    );
  });
});
