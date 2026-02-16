import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavDirectMessages } from './nav-direct-messages';
import { SidebarProvider } from '../../ui/sidebar';

describe('NavDirectMessages', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows total unread count in the section header', () => {
    render(
      <SidebarProvider>
        <NavDirectMessages
          dms={[
            makeDm('dm-1', 'account-self', 2),
            makeDm('dm-2', 'account-self', 3),
          ]}
          currentUserId="account-self"
        />
      </SidebarProvider>,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('animates the section unread badge when unread count increases', () => {
    vi.useFakeTimers();

    const { container, rerender } = render(
      <SidebarProvider>
        <NavDirectMessages
          dms={[makeDm('dm-1', 'account-self', 1)]}
          currentUserId="account-self"
        />
      </SidebarProvider>,
    );

    const initialBadge = container.querySelector(
      '[data-unread-animated]',
    ) as HTMLElement | null;
    expect(initialBadge).not.toBeNull();
    expect(initialBadge).toHaveAttribute('data-unread-animated', 'false');

    rerender(
      <SidebarProvider>
        <NavDirectMessages
          dms={[makeDm('dm-1', 'account-self', 2)]}
          currentUserId="account-self"
        />
      </SidebarProvider>,
    );

    const increasedBadge = container.querySelector(
      '[data-unread-animated]',
    ) as HTMLElement | null;
    expect(increasedBadge).not.toBeNull();
    expect(increasedBadge).toHaveAttribute('data-unread-animated', 'true');
    expect(increasedBadge).toHaveClass('animate-pulse');

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(container.querySelector('[data-unread-animated]')).toHaveAttribute(
      'data-unread-animated',
      'false',
    );
    expect(container.querySelector('[data-unread-animated]')).not.toHaveClass(
      'animate-pulse',
    );
  });

  it('sorts unread first, then by recent activity', () => {
    render(
      <SidebarProvider>
        <NavDirectMessages
          dms={[
            makeDm('dm-read-old', 'account-self', 0, '2026-02-14T09:00:00.000Z'),
            makeDm('dm-unread-low', 'account-self', 1, '2026-02-15T10:00:00.000Z'),
            makeDm(
              'dm-read-latest-message',
              'account-self',
              0,
              '2026-02-15T08:00:00.000Z',
              '2026-02-15T12:00:00.000Z',
            ),
            makeDm('dm-unread-high', 'account-self', 2, '2026-02-15T11:00:00.000Z'),
          ]}
          currentUserId="account-self"
        />
      </SidebarProvider>,
    );

    const dmLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href && href.startsWith('/d/dm/')));

    expect(dmLinks).toEqual([
      '/d/dm/dm-unread-high',
      '/d/dm/dm-unread-low',
      '/d/dm/dm-read-latest-message',
      '/d/dm/dm-read-old',
    ]);
  });

  it('shows participant name and unread badge for a brand-new DM before read state persists', () => {
    render(
      <SidebarProvider>
        <NavDirectMessages
          dms={[
            {
              ids: { id: 'dm-new' },
              basics: { topic: null },
              collections: {
                readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
                participants: [],
                messages: {
                  items: [
                    {
                      ids: { id: 'msg-1', orgId: 'org-1' },
                      core: {
                        createdAt: '2026-02-16T10:00:00.000Z',
                        sender: {
                          ids: { accountId: 'account-other' },
                          profile: {
                            displayName: 'Brand New Person',
                            firstName: 'Brand',
                            lastName: 'New',
                            avatar: { source: 'seed', seed: 'brand-new' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            } as any,
          ]}
          currentUserId="account-self"
        />
      </SidebarProvider>,
    );

    expect(screen.getByText('Brand New Person')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
  });
});

function makeDm(
  id: string,
  currentUserId: string,
  unreadCount: number,
  lastReadAt?: string,
  lastMessageAt?: string,
) {
  return {
    ids: { id },
    basics: { topic: `DM ${id}` },
    collections: {
      readState: { unreadCount, lastReadAt: lastReadAt ?? null },
      messages: {
        items: lastMessageAt
          ? [
              {
                ids: { id: `${id}-msg`, orgId: 'org-1' },
                core: { createdAt: lastMessageAt },
              },
            ]
          : [],
      },
      participants: [
        {
          ids: { accountId: currentUserId },
          profile: {
            displayName: 'Self',
            firstName: 'Self',
            lastName: '',
            avatar: { source: 'seed', seed: 'self' },
          },
        },
        {
          ids: { accountId: `other-${id}` },
          profile: {
            displayName: `User ${id}`,
            firstName: 'User',
            lastName: id,
            avatar: { source: 'seed', seed: id },
          },
          presence: { state: {}, liveStatus: 'offline' },
          ui: { themeKey: null },
        },
      ],
    },
  } as any;
}
