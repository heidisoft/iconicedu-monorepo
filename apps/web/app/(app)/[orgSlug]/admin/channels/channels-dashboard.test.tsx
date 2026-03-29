import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';
import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';

vi.mock('next/navigation', () => ({
  usePathname: () => '/iconic-academy/admin/channels',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

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
    const rows = [
      makeRow({ topic: 'General' }),
      makeRow({ id: 'channel-2', topic: 'Algebra' }),
    ];

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
    const rows = [
      makeRow({ topic: 'General' }),
      makeRow({ id: 'channel-2', topic: 'Algebra' }),
    ];

    render(<ChannelsDashboard rows={rows} />);
    await user.type(screen.getByPlaceholderText('Search name or type'), 'alg');
    expect(screen.queryByText('General')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search name or type'));
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
  });

  it('submits the selected channel icon in the payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    const user = userEvent.setup();

    render(<ChannelsDashboard rows={[makeRow({ topic: 'General' })]} />);

    await user.click(screen.getByRole('button', { name: 'Create channel' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name *'), 'Parent Lounge');
    await user.click(within(dialog).getByLabelText('Icon'));
    await user.click(screen.getByRole('option', { name: 'Support' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create channel' }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/admin/channels/create',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    );

    const createCallBody = fetchMock.mock.calls[1]?.[1];
    expect(createCallBody).toBeDefined();
    expect(JSON.parse(String(createCallBody?.body))).toMatchObject({
      basics: {
        topic: 'Parent Lounge',
        iconKey: 'life-buoy',
      },
    });
  });
});
