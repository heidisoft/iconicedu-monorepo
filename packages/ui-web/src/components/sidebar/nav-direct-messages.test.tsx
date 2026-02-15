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

  it('moves unread direct messages to the top while preserving relative order', () => {
    render(
      <SidebarProvider>
        <NavDirectMessages
          dms={[
            makeDm('dm-read-a', 'account-self', 0),
            makeDm('dm-unread-a', 'account-self', 2),
            makeDm('dm-read-b', 'account-self', 0),
            makeDm('dm-unread-b', 'account-self', 1),
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
      '/d/dm/dm-unread-a',
      '/d/dm/dm-unread-b',
      '/d/dm/dm-read-a',
      '/d/dm/dm-read-b',
    ]);
  });
});

function makeDm(id: string, currentUserId: string, unreadCount: number) {
  return {
    ids: { id },
    basics: { topic: `DM ${id}` },
    collections: {
      readState: { unreadCount },
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
