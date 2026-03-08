import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LearningSpaceVM, UserProfileVM } from '@iconicedu/shared-types';

import { NavLearningSpaces } from './nav-learning-spaces';
import { SidebarProvider } from '../../ui/sidebar';

describe('NavLearningSpaces', () => {
  it('shows unread badge for classes with unread messages', () => {
    render(
      <SidebarProvider>
        <NavLearningSpaces
          title="Child One"
          participant={
            {
              ids: { id: 'profile-child', orgId: 'org-1', accountId: 'account-child' },
              profile: {
                displayName: 'Child One',
                firstName: 'Child',
                lastName: 'One',
                avatar: { source: 'seed', seed: 'child-1' },
              },
              ui: {},
            } as unknown as Pick<UserProfileVM, 'ids' | 'profile' | 'ui'>
          }
          isOpen={true}
          onOpenChange={() => undefined}
          activeChannelId={null}
          isMobile={false}
          learningSpaces={
            [
              {
                ids: { id: 'space-1', orgId: 'org-1' },
                basics: { title: 'Reading', subject: 'English', iconKey: null },
                channels: {
                  primaryChannel: {
                    ids: { id: 'channel-1', orgId: 'org-1' },
                    basics: { iconKey: null },
                    ui: {},
                    collections: { readState: { unreadCount: 3 } },
                  },
                },
              },
              {
                ids: { id: 'space-2', orgId: 'org-1' },
                basics: { title: 'Math Club', subject: 'Algebra', iconKey: null },
                channels: {
                  primaryChannel: {
                    ids: { id: 'channel-2', orgId: 'org-1' },
                    basics: { iconKey: null },
                    ui: {},
                    collections: { readState: { unreadCount: 0 } },
                  },
                },
              },
            ] as unknown as LearningSpaceVM[]
          }
        />
      </SidebarProvider>,
    );

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('Math Club')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('uses org-scoped base path when provided', () => {
    render(
      <SidebarProvider>
        <NavLearningSpaces
          title="Child One"
          participant={
            {
              ids: { id: 'profile-child', orgId: 'org-1', accountId: 'account-child' },
              profile: {
                displayName: 'Child One',
                firstName: 'Child',
                lastName: 'One',
                avatar: { source: 'seed', seed: 'child-1' },
              },
              ui: {},
            } as unknown as Pick<UserProfileVM, 'ids' | 'profile' | 'ui'>
          }
          isOpen={true}
          onOpenChange={() => undefined}
          activeChannelId={null}
          isMobile={false}
          dashboardBasePath="/iconic-academy"
          learningSpaces={
            [
              {
                ids: { id: 'space-1', orgId: 'org-1' },
                basics: { title: 'Reading', subject: 'English', iconKey: null },
                channels: {
                  primaryChannel: {
                    ids: { id: 'channel-1', orgId: 'org-1' },
                    basics: { iconKey: null },
                    ui: {},
                    collections: { readState: { unreadCount: 0 } },
                  },
                },
              },
            ] as unknown as LearningSpaceVM[]
          }
        />
      </SidebarProvider>,
    );

    expect(screen.getByRole('link', { name: /Reading/i })).toHaveAttribute(
      'href',
      '/iconic-academy/spaces/channel-1',
    );
  });
});
