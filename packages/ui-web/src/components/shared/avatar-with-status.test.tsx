/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadSubject = async () => {
  return import('./avatar-with-status');
};

describe('AvatarWithStatus', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the avatar without a hover preview shell', async () => {
    const { AvatarWithStatus } = await loadSubject();

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
      />,
    );

    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-preview-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avatar-preview-avatar-anchor')).not.toBeInTheDocument();
  });

  it('does not fetch or render preview details when preview props are provided', async () => {
    const { AvatarWithStatus } = await loadSubject();

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

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
          enableProfilePreview
        />,
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByText('New York, NY, United States')).not.toBeInTheDocument();
      expect(screen.queryByText('Educator')).not.toBeInTheDocument();
      expect(screen.queryByText('Math educator')).not.toBeInTheDocument();
      expect(screen.queryByText('priya@example.com')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
