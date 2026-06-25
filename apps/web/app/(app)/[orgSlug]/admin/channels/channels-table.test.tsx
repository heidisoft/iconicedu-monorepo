import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { ChannelsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-table';
import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';

vi.mock('next/navigation', () => ({
  usePathname: () => '/iconic-academy/admin/channels',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const baseRow: AdminChannelRow = {
  id: 'channel-1',
  org_id: 'org-1',
  kind: 'channel',
  topic: 'General',
  icon_key: null,
  description: null,
  visibility: 'private',
  purpose: 'general',
  status: 'active',
  dm_key: null,
  posting_policy_kind: 'members-only',
  allow_threads: true,
  allow_reactions: true,
  primary_entity_kind: null,
  primary_entity_id: null,
  created_by_profile_id: null,
  created_at: '2025-01-01T00:00:00.000Z',
  archived_at: null,
  created_by: null,
  updated_at: '2025-01-01T00:00:00.000Z',
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
  participantCount: 3,
  participantDetails: [],
};

describe('ChannelsTable', () => {
  it('renders channel rows', () => {
    render(<ChannelsTable rows={[baseRow]} orgSlug="iconic-academy" />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
  });

  it('shows direct row action buttons', () => {
    render(<ChannelsTable rows={[baseRow]} orgSlug="iconic-academy" />);

    expect(screen.getByRole('button', { name: 'Edit General' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive General' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete General' })).toBeInTheDocument();
  });

  it('links class channels to class pages', () => {
    const learningSpaceRow: AdminChannelRow = {
      ...baseRow,
      id: 'channel-2',
      topic: 'Algebra',
      purpose: 'learning-space',
      primary_entity_kind: 'learning_space',
    };

    render(<ChannelsTable rows={[baseRow, learningSpaceRow]} orgSlug="iconic-academy" />);

    const generalLink = screen.getByRole('link', { name: 'General' });
    expect(generalLink).toHaveAttribute('href', '/iconic-academy/c/channel-1');

    const learningSpaceLink = screen.getByRole('link', { name: 'Algebra' });
    expect(learningSpaceLink).toHaveAttribute('href', '/iconic-academy/s/channel-2');
  });
});
