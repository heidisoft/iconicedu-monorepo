/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessagesContainerHeader } from './messages-container-header';
import { MessagesTopSurface } from './messages-top-surface';

vi.mock('./context/messages-state-provider', () => ({
  useMessagesState: () => ({
    savedCount: 0,
    homeworkCount: 0,
    sessionSummaryCount: 0,
    currentUserId: 'profile-self',
    toggle: vi.fn(),
    messageFilter: null,
    toggleMessageFilter: vi.fn(),
  }),
}));

const makeParticipant = (id: string, overrides?: Record<string, unknown>) =>
  ({
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    profile: { displayName: `User ${id}`, avatar: { source: 'seed', url: null } },
    ui: { themeKey: null },
    presence: null,
    ...overrides,
  }) as any;

describe('MessagesContainerHeader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows online status indicator for DM profile avatar', () => {
    const { container } = render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'DM' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-other', {
                  presence: { liveStatus: 'online', displayStatus: 'online', state: {} },
                }),
              ],
            },
            ui: {},
          } as any
        }
      />,
    );

    expect(screen.getByLabelText('Status: online')).toBeInTheDocument();
    expect(container.querySelector('.h-8.w-8')).toBeInTheDocument();
  });

  it('exposes the themed top-surface hook when wrapped for a themed channel', () => {
    render(
      <MessagesTopSurface
        channel={
          {
            basics: { kind: 'channel', topic: 'Science', purpose: 'general' },
            collections: { participants: [] },
            ui: { themeKey: 'cyan', headerQuickMetaActions: [] },
          } as any
        }
        data-testid="messages-top-surface-header"
      >
        <MessagesContainerHeader
          channel={
            {
              basics: { kind: 'channel', topic: 'Science', purpose: 'general' },
              collections: { participants: [] },
              ui: { themeKey: 'cyan', headerQuickMetaActions: [] },
            } as any
          }
        />
      </MessagesTopSurface>,
    );

    expect(screen.getByTestId('messages-top-surface-header')).toHaveAttribute(
      'data-channel-theme',
      'cyan',
    );
  });

  it('uses the fallback top-surface hook when the channel has no theme', () => {
    render(
      <MessagesTopSurface
        channel={
          {
            basics: { kind: 'channel', topic: 'General', purpose: 'general' },
            collections: { participants: [] },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
        data-testid="messages-top-surface-header"
      >
        <MessagesContainerHeader
          channel={
            {
              basics: { kind: 'channel', topic: 'General', purpose: 'general' },
              collections: { participants: [] },
              ui: { headerQuickMetaActions: [] },
            } as any
          }
        />
      </MessagesTopSurface>,
    );

    expect(screen.getByTestId('messages-top-surface-header')).toHaveAttribute(
      'data-channel-theme',
      'fallback',
    );
  });

  it('shows last seen and mobile-style local time under the header name for non-online DMs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T14:41:00.000Z'));

    render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'DM' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-other', {
                  prefs: { timezone: 'America/New_York' },
                  presence: {
                    liveStatus: 'away',
                    displayStatus: 'away',
                    state: {},
                    lastSeenAt: '2026-03-25T14:40:00.000Z',
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    expect(screen.getByText('Last seen 1m ago')).toBeInTheDocument();
    expect(screen.getByText('10:41 AM')).toBeInTheDocument();
    expect(screen.getByTestId('dm-header-local-time-icon')).toBeInTheDocument();
  });

  it('shows available and mobile-style local time for online DMs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T14:41:00.000Z'));

    render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'DM' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-other', {
                  prefs: { timezone: 'America/New_York' },
                  presence: {
                    liveStatus: 'online',
                    displayStatus: 'online',
                    state: {},
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('10:41 AM')).toBeInTheDocument();
    expect(screen.getByTestId('dm-header-local-time-icon')).toBeInTheDocument();
  });

  it('uses the offline local-time icon when the DM participant is offline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T14:41:00.000Z'));

    render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'DM' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-other', {
                  prefs: { timezone: 'America/New_York' },
                  presence: {
                    liveStatus: 'offline',
                    displayStatus: 'offline',
                    state: {},
                    lastSeenAt: '2026-03-25T12:41:00.000Z',
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    expect(screen.getByText('Last seen 2h ago')).toBeInTheDocument();
    expect(screen.getByText('10:41 AM')).toBeInTheDocument();
    expect(screen.getByTestId('dm-header-local-time-icon')).toBeInTheDocument();
  });

  it('shows all non-viewer classroom participants under the header title', () => {
    render(
      <MessagesContainerHeader
        channel={
          {
            basics: {
              kind: 'channel',
              topic: 'Math Foundations',
              purpose: 'learning-space',
            },
            collections: {
              participants: [
                makeParticipant('profile-self', {
                  kind: 'guardian',
                  profile: {
                    displayName: 'Riley Johnson',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('educator-1', {
                  kind: 'educator',
                  profile: {
                    displayName: 'Priya Patel',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('student-1', {
                  kind: 'child',
                  profile: {
                    displayName: 'Maya Johnson',
                    avatar: { source: 'seed', url: null },
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Maya Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Riley Johnson')).not.toBeInTheDocument();
  });

  it('shows a staff indicator next to the DM title for staff participants', async () => {
    const user = userEvent.setup();

    render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'Support' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-staff', {
                  kind: 'staff',
                  profile: {
                    displayName: 'ICONIC Support',
                    avatar: { source: 'seed', url: null },
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    const trigger = screen.getByLabelText('STAFF');
    expect(screen.getByTestId('staff-name-indicator')).toBeInTheDocument();

    await user.hover(trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('STAFF');
  });

  it('shows a staff indicator next to classroom staff participant names', async () => {
    const user = userEvent.setup();

    render(
      <MessagesContainerHeader
        channel={
          {
            basics: {
              kind: 'channel',
              topic: 'Math Foundations',
              purpose: 'learning-space',
            },
            collections: {
              participants: [
                makeParticipant('profile-self', {
                  kind: 'guardian',
                  profile: {
                    displayName: 'Riley Johnson',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('staff-1', {
                  kind: 'staff',
                  profile: {
                    displayName: 'ICONIC Support',
                    avatar: { source: 'seed', url: null },
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    const trigger = screen.getByLabelText('STAFF');
    expect(screen.getByText('ICONIC Support')).toBeInTheDocument();

    await user.hover(trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('STAFF');
  });

  it('groups classroom students under a single role icon label', () => {
    render(
      <MessagesContainerHeader
        channel={
          {
            basics: {
              kind: 'channel',
              topic: 'Science Lab Explorers',
              purpose: 'learning-space',
            },
            collections: {
              participants: [
                makeParticipant('profile-self', {
                  kind: 'guardian',
                  profile: {
                    displayName: 'Riley Johnson',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('student-1', {
                  kind: 'child',
                  profile: {
                    displayName: 'Maya Johnson',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('student-2', {
                  kind: 'child',
                  profile: {
                    displayName: 'Tevin Brooks',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('student-3', {
                  kind: 'child',
                  profile: {
                    displayName: 'Tehara Singh',
                    avatar: { source: 'seed', url: null },
                  },
                }),
                makeParticipant('educator-1', {
                  kind: 'educator',
                  profile: {
                    displayName: 'Priya Patel',
                    avatar: { source: 'seed', url: null },
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Maya Johnson')).toBeInTheDocument();
    expect(screen.getByText('Tevin Brooks')).toBeInTheDocument();
    expect(screen.getByText('Tehara Singh')).toBeInTheDocument();
  });
});
