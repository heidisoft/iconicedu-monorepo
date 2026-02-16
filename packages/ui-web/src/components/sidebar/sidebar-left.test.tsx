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

describe('SidebarLeft', () => {
  it('shows educator learning spaces on the sidebar', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Learning spaces')).toBeInTheDocument();
    expect(screen.getByText('Algebra 1')).toBeInTheDocument();
    expect(screen.queryByText('Chemistry')).not.toBeInTheDocument();
  });
});
