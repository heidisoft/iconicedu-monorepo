import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChannelInfoPanel } from './channel-info-panel';

vi.mock('../context/messages-state-provider', () => ({
  useMessagesState: () => ({
    channel: {
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { iconKey: null, topic: 'General', purpose: 'general', description: null },
      ui: {},
      collections: {
        media: { items: [] },
        files: { items: [] },
        participants: [
          {
            ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
            profile: { displayName: 'User 1', avatar: { url: null, source: 'seed' } },
            ui: { themeKey: null },
            presence: { liveStatus: 'online', displayStatus: 'online', state: {} },
          },
          {
            ids: { id: 'profile-2', orgId: 'org-1', accountId: 'account-2' },
            profile: { displayName: 'User 2', avatar: { url: null, source: 'seed' } },
            ui: { themeKey: null },
            presence: { liveStatus: 'online', displayStatus: 'online', state: {} },
          },
        ],
      },
    },
    currentUserId: 'profile-1',
  }),
}));

describe('ChannelInfoPanel', () => {
  it('links to dm using member id', () => {
    render(<ChannelInfoPanel intent={{ key: 'channel_info' }} />);

    expect(screen.getByRole('link', { name: /Message User 2/i })).toHaveAttribute(
      'href',
      '/d/dm/profile-2',
    );
  });

  it('hides online status indicators in members list', () => {
    render(<ChannelInfoPanel intent={{ key: 'channel_info' }} />);
    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument();
  });
});
