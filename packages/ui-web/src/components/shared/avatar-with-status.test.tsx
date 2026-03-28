/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
