import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/d/spaces/[channelId]/page';

const learningSpaceShellMock = vi.fn(() => null);
const buildChannelByIdMock = vi.fn();

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
}));

vi.mock('@iconicedu/web/app/(app)/d/spaces/[channelId]/learning-space-shell', () => ({
  LearningSpaceShell: (props: unknown) => learningSpaceShellMock(props),
}));

vi.mock('@iconicedu/web/app/actions/messages', () => ({
  sendTextMessageAction: vi.fn(),
  toggleMessageReactionAction: vi.fn(),
  deleteMessageAction: vi.fn(),
  toggleHiddenMessageAction: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user', email: 'test@example.com' })),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: vi.fn(async () => ({ account: { id: 'account-1', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: vi.fn(async () => ({ ids: { id: 'profile-1', orgId: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/spaces/builders/learning-space.builder', () => ({
  buildLearningSpaceByChannelId: vi.fn(async () => null),
}));

describe('d/spaces/[channelId] page', () => {
  it('passes currentUserId to LearningSpaceShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: { participants: [{ ids: { accountId: 'account-1' } }] },
    });
    const element = await Page({ params: Promise.resolve({ channelId: 'channel-1' }) });
    render(element as React.ReactElement);
    expect(learningSpaceShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: 'profile-1',
        currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
        readOnly: false,
      }),
    );
  });

  it('enables read-only mode for staff who are not learning space channel participants', async () => {
    const { buildUserProfileById } = await import(
      '@iconicedu/web/lib/profile/builders/user-profile.builder'
    );
    vi.mocked(buildUserProfileById).mockResolvedValueOnce({
      kind: 'staff',
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    } as any);
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: { participants: [{ ids: { accountId: 'account-2' } }] },
    });

    const element = await Page({ params: Promise.resolve({ channelId: 'channel-1' }) });
    render(element as React.ReactElement);
    expect(learningSpaceShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readOnly: true,
      }),
    );
  });
});
