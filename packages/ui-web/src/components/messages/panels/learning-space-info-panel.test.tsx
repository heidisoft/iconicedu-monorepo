import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LearningSpaceInfoPanel } from './learning-space-info-panel';

vi.mock('../../../hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('../context/messages-state-provider', () => ({
  useMessagesState: () => ({
    channel: {
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { iconKey: null, topic: 'General' },
      ui: {},
      collections: { media: { items: [] }, files: { items: [] } },
    },
    toggle: vi.fn(),
    messageFilter: null,
    toggleMessageFilter: vi.fn(),
    currentUserId: 'profile-1',
  }),
}));

const makeProfile = (id: string) => ({
  ids: { id, orgId: 'org-1', accountId: `account-${id}` },
  profile: { displayName: `User ${id}`, avatar: { url: null, source: 'seed' } },
  ui: { themeKey: null },
  presence: { liveStatus: 'online', displayStatus: 'online', state: {} },
});

describe('LearningSpaceInfoPanel', () => {
  it('links to dm using member id', () => {
    render(
      <LearningSpaceInfoPanel
        intent={{ key: 'channel_info' }}
        learningSpace={{
          basics: { title: 'Algebra', kind: 'small_group', iconKey: null, description: null },
          schedule: null,
          resources: { links: [] },
          participants: [makeProfile('profile-1'), makeProfile('profile-2')],
        } as any}
      />,
    );

    expect(screen.getByRole('link', { name: /Message User profile-2/i })).toHaveAttribute(
      'href',
      '/d/dm/profile-2',
    );
  });

  it('hides online status indicators in members list', () => {
    render(
      <LearningSpaceInfoPanel
        intent={{ key: 'channel_info' }}
        learningSpace={{
          basics: { title: 'Algebra', kind: 'small_group', iconKey: null, description: null },
          schedule: null,
          resources: { links: [] },
          participants: [makeProfile('profile-1'), makeProfile('profile-2')],
        } as any}
      />,
    );

    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument();
  });
});
