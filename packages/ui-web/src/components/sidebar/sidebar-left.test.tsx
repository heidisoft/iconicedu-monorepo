import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SidebarLeft } from './sidebar-left';
import { SidebarProvider } from '../../ui/sidebar';

function makeData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'educator',
        ids: {
          id: 'profile-educator',
          orgId: 'org-1',
          accountId: 'account-educator',
        },
        profile: {
          displayName: 'Educator One',
          firstName: 'Educator',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'educator' },
        },
        prefs: {},
        meta: {},
      },
      account: { id: 'account-educator', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-1', orgId: 'org-1' },
          basics: { title: 'Algebra 1', subject: 'Math', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-1', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 2 },
                participants: [{ ids: { accountId: 'account-educator' } }],
              },
            },
          },
        },
        {
          ids: { id: 'space-2', orgId: 'org-1' },
          basics: { title: 'Chemistry', subject: 'Science', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-2', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 5 },
                participants: [{ ids: { accountId: 'account-other' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as any;
}

function makeGuardianData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'guardian',
        ids: {
          id: 'profile-guardian',
          orgId: 'org-1',
          accountId: 'account-guardian',
        },
        profile: {
          displayName: 'Parent One',
          firstName: 'Parent',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'parent' },
        },
        prefs: {},
        meta: {},
        children: {
          items: [
            {
              ids: {
                id: 'profile-child-1',
                orgId: 'org-1',
                accountId: 'account-child-1',
              },
              profile: {
                displayName: 'Child One',
                firstName: 'Child',
                lastName: 'One',
                avatar: { source: 'seed', seed: 'child-1' },
              },
              ui: {},
            },
            {
              ids: {
                id: 'profile-child-2',
                orgId: 'org-1',
                accountId: 'account-child-2',
              },
              profile: {
                displayName: 'Child Two',
                firstName: 'Child',
                lastName: 'Two',
                avatar: { source: 'seed', seed: 'child-2' },
              },
              ui: {},
            },
          ],
        },
      },
      account: { id: 'account-guardian', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-child-1', orgId: 'org-1' },
          basics: { title: 'Reading', subject: 'English', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-child-1', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 1 },
                participants: [{ ids: { accountId: 'account-child-1' } }],
              },
            },
          },
        },
        {
          ids: { id: 'space-child-2', orgId: 'org-1' },
          basics: { title: 'Math Club', subject: 'Math', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-child-2', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 3 },
                participants: [{ ids: { accountId: 'account-child-2' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as any;
}

describe('SidebarLeft', () => {
  it('shows educator learning spaces on the sidebar', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Learning spaces')).toBeInTheDocument();
    expect(screen.getByText('Algebra 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Algebra 1/i })).toHaveAttribute(
      'href',
      '/d/spaces/channel-1',
    );
    expect(screen.queryByText('Chemistry')).not.toBeInTheDocument();
    expect(screen.queryByText('Educator')).not.toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Direct Messages')).not.toBeInTheDocument();
  });

  it('keeps all parent learning spaces expanded', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeGuardianData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('Math Club')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows educator learning-space unread when participant accountId is missing', () => {
    const data = makeData();
    data.collections.learningSpaces = [
      {
        ids: { id: 'space-1', orgId: 'org-1' },
        basics: { title: 'Physics', subject: 'Science', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-physics', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              participants: [{ ids: { id: 'profile-educator' } }],
              readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
              messages: {
                items: [
                  {
                    core: {
                      sender: { ids: { accountId: 'account-other' } },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];

    render(
      <SidebarProvider>
        <SidebarLeft data={data} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Physics/i })).toHaveAttribute(
      'href',
      '/d/spaces/channel-physics',
    );
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });
});
