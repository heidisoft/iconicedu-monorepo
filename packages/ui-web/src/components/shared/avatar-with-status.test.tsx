/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvatarWithStatus } from './avatar-with-status';

vi.mock('@iconicedu/ui-web/ui/hover-card', () => ({
  HoverCard: ({
    children,
    onOpenChange,
  }: {
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    React.useEffect(() => {
      onOpenChange?.(true);
    }, [onOpenChange]);
    return <div>{children}</div>;
  },
  HoverCardTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  HoverCardContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('AvatarWithStatus', () => {
  it('renders the shared avatar preview shell with direct message action', () => {
    render(
      <AvatarWithStatus
        profileId="profile-2"
        name="Priya Shah"
        avatar={{ source: 'seed', seed: 'priya' }}
        presence={{
          liveStatus: 'online',
          displayStatus: 'online',
          state: {},
        }}
        messageHref="/dm/profile-2"
      />,
    );

    expect(screen.getByRole('link', { name: /send direct message/i })).toHaveAttribute(
      'href',
      '/dm/profile-2',
    );
    expect(screen.getByTestId('avatar-preview-header')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-preview-avatar-anchor')).toBeInTheDocument();
  });

  it('keeps rendering fallback preview details when the enhancement request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Not authenticated')));

    try {
      render(
        <AvatarWithStatus
          accountId="account-2"
          profileId="profile-2"
          name="Priya Shah"
          avatar={{ source: 'seed', seed: 'priya' }}
          roleLabel="Educator"
          locationLabel="New York, NY, United States"
          about="Math educator"
          email="priya@example.com"
          messageHref="/dm/profile-2"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('New York, NY, United States')).toBeInTheDocument();
      });

      expect(screen.getByText('Educator')).toBeInTheDocument();
      expect(screen.getByText('Math educator')).toBeInTheDocument();
      expect(screen.getByText('priya@example.com')).toBeInTheDocument();
      expect(screen.queryByText('Unable to load profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Not authenticated')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
