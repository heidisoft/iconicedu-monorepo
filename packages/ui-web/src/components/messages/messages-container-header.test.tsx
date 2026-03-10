/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('hides online status indicator for DM profile avatar', () => {
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

    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument();
    expect(container.querySelector('.h-8.w-8')).toBeInTheDocument();
  });

  it('shows participant status message directly under the header name', () => {
    render(
      <MessagesContainerHeader
        channel={
          {
            basics: { kind: 'dm', topic: 'DM' },
            collections: {
              participants: [
                makeParticipant('profile-self'),
                makeParticipant('profile-other', {
                  presence: {
                    liveStatus: 'in_class',
                    displayStatus: 'online',
                    state: { emoji: '🏠', text: 'Working remotely' },
                  },
                }),
              ],
            },
            ui: { headerQuickMetaActions: [] },
          } as any
        }
      />,
    );

    const statusText = screen.getByText('🏠 Working remotely');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveClass('text-xs');
  });
});
