/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessagesContainerHeader } from './messages-container-header';

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

  it('shows last seen and local time directly under the header name for offline DMs', () => {
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

    const statusText = screen.getByText('Last seen 1m ago · 10:41 AM (Local time)');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveClass('text-xs');
  });

  it('shows available and local time for online DMs', () => {
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

    const statusText = screen.getByText('Available · 10:41 AM (Local time)');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveClass('text-xs');
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
    expect(
      screen.getByText('Maya Johnson, Tevin Brooks, Tehara Singh'),
    ).toBeInTheDocument();
  });
});
