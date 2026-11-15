import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomePageInfographicClient } from './home-page-infographic-client';

const dashboardHomeInfographicSectionMock = vi.fn(() => null);
const pushMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHomeInfographicSection: (props: unknown) =>
    dashboardHomeInfographicSectionMock(props),
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({
    post: (...args: unknown[]) => apiPostMock(...args),
  })),
}));

describe('HomePageInfographicClient', () => {
  beforeEach(() => {
    dashboardHomeInfographicSectionMock.mockClear();
    pushMock.mockClear();
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({ joinPath: 'https://zoom.us/j/123' });
  });

  it('shows an external join dialog instead of navigating away for external join paths', async () => {
    render(
      <HomePageInfographicClient
        orgSlug="iconic-academy"
        orgId="org-1"
        currentUserId="profile-1"
        topMetrics={{
          upcomingSessionsThisWeek: 1,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 1,
          activeSubjectsLabel: 'Math',
        }}
        upcomingSessionsPage={{
          thisWeek: { items: [], total: 0, pageSize: 1, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 1, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    const props = dashboardHomeInfographicSectionMock.mock.calls[0]?.[0] as {
      onJoinSession?: (item: {
        channelId?: string | null;
        joinHref: string;
      }) => Promise<void>;
    };

    await act(async () => {
      await props.onJoinSession?.({
        channelId: 'channel-1',
        joinHref: '/iconic-academy/s/channel-1',
      });
    });

    expect(apiPostMock).toHaveBeenCalledWith('/channels/channel-1/live-sessions/join', {
      orgId: 'org-1',
      profileId: 'profile-1',
    });
    await waitFor(() => {
      expect(screen.getByText('Session ready to join')).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
