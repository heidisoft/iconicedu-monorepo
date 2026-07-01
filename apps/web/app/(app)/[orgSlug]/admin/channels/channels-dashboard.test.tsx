import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function makeListResponse(rows: AdminChannelRow[]) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      rows,
      total: rows.length,
      pageCount: 1,
    }),
  } as Response;
}

function makeParticipantsResponse() {
  return { ok: true, json: async () => ({ data: [] }) } as Response;
}

describe('ChannelsDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows rows returned from the list API', async () => {
    const rows = [
      makeRow({ topic: 'General' }),
      makeRow({ id: 'channel-2', topic: 'Algebra' }),
    ];
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/admin/channels/list'))
        return Promise.resolve(makeListResponse(rows));
      return Promise.resolve(makeParticipantsResponse());
    });

    render(<ChannelsDashboard orgSlug="iconic-academy" />);

    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Algebra')).toBeInTheDocument();
    });
  });

  it('shows empty state when no rows returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/admin/channels/list'))
        return Promise.resolve(makeListResponse([]));
      return Promise.resolve(makeParticipantsResponse());
    });

    render(<ChannelsDashboard orgSlug="iconic-academy" />);

    await waitFor(() => {
      expect(screen.getByText('No channels found.')).toBeInTheDocument();
    });
  });

  it('submits the selected channel icon in the payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/admin/channels/create')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      if (String(url).includes('/api/admin/channels/list')) {
        return Promise.resolve(makeListResponse([makeRow({ topic: 'General' })]));
      }
      return Promise.resolve(makeParticipantsResponse());
    });

    const user = userEvent.setup();
    render(<ChannelsDashboard orgSlug="iconic-academy" />);

    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add new/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name *'), 'Parent Lounge');
    const iconTrigger = within(dialog).getByLabelText('Icon');
    await user.click(iconTrigger);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: 'Support' }));
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Icon')).toHaveTextContent('Support');
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create channel' }));

    const createCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/admin/channels/create'),
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      basics: { topic: 'Parent Lounge', iconKey: 'life-buoy' },
    });
  }, 15000);
});
