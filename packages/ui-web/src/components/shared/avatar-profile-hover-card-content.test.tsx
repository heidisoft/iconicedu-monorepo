/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvatarProfileHoverCardContent } from './avatar-profile-hover-card-content';

vi.mock('@iconicedu/ui-web/ui/hover-card', () => ({
  HoverCardContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('AvatarProfileHoverCardContent', () => {
  it('renders the updated loading shell with the current hover-card structure', () => {
    const { container } = render(
      <AvatarProfileHoverCardContent
        avatarNode={<div data-testid="preview-avatar" />}
        canMessage
        loading
        messageHref="/dm/profile-2"
        safeName="Priya Shah"
      />,
    );

    expect(screen.getByTestId('avatar-preview-header')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-preview-avatar-anchor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /send direct message/i })).toHaveAttribute(
      'href',
      '/dm/profile-2',
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThanOrEqual(6);
  });
});
