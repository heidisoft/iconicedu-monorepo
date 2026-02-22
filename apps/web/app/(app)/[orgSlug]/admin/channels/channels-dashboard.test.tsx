import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';
import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';

const makeRow = (overrides: Partial<AdminChannelRow>): AdminChannelRow => ({
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
  participantCount: 2,
  participantDetails: [],
  ...overrides,
});

describe('ChannelsDashboard', () => {
  const mockFetch = () =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters rows by search input', async () => {
    mockFetch();
    const user = userEvent.setup();
    const rows = [makeRow({ topic: 'General' }), makeRow({ id: 'channel-2', topic: 'Algebra' })];

    render(<ChannelsDashboard rows={rows} />);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search name or type'), 'alg');

    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
  });

  it('shows all rows when search is cleared', async () => {
    mockFetch();
    const user = userEvent.setup();
    const rows = [makeRow({ topic: 'General' }), makeRow({ id: 'channel-2', topic: 'Algebra' })];

    render(<ChannelsDashboard rows={rows} />);
    await user.type(screen.getByPlaceholderText('Search name or type'), 'alg');
    expect(screen.queryByText('General')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search name or type'));
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
  });
});
