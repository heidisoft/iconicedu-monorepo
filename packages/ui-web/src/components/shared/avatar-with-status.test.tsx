/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvatarWithStatus } from './avatar-with-status';

vi.mock('@iconicedu/ui-web/ui/hover-card', () => ({
  HoverCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  HoverCardContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('AvatarWithStatus', () => {
  it('renders the richer profile preview fields when provided', () => {
    render(
      <AvatarWithStatus
        name="Priya Shah"
        avatar={{ source: 'seed', seed: 'priya' }}
        presence={{
          liveStatus: 'online',
          displayStatus: 'online',
          state: {},
        }}
        roleLabel="Educator"
        locationLabel="Los Angeles, California, United States"
        timezone="America/Los_Angeles"
        about="Math mentor focused on building confidence and fluency."
        messageHref="/dm/profile-2"
      />,
    );

    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('Educator')).toBeInTheDocument();
    expect(
      screen.getByText('Los Angeles, California, United States'),
    ).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(
      screen.getByText('Math mentor focused on building confidence and fluency.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /message/i })).toHaveAttribute(
      'href',
      '/dm/profile-2',
    );
    expect(screen.getByText(/local time/i)).toBeInTheDocument();
  });
});
