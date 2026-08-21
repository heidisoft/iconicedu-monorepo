import type { RawMessageRow } from '@iconicedu/shared-types';
import { filterVisibleMessageRows } from '@iconicedu/api/lib/messages/message-visibility';

function makeRow(overrides: Partial<RawMessageRow> = {}): RawMessageRow {
  return {
    id: 'message-1',
    org_id: 'org-1',
    channel_id: 'channel-1',
    sender_profile_id: 'profile-sender',
    visibility_type: 'all',
    visibility_user_ids: null,
    type: 'text',
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:01:00.000Z',
    thread_parent_id: null,
    sender: null,
    ...overrides,
  };
}

describe('filterVisibleMessageRows', () => {
  it('keeps public and legacy rows while preserving their order and shape', () => {
    const rows = [
      { ...makeRow({ id: 'all' }), marker: 1 },
      { ...makeRow({ id: 'legacy-null', visibility_type: null }), marker: 2 },
      { ...makeRow({ id: 'legacy-undefined', visibility_type: undefined }), marker: 3 },
    ];

    const result = filterVisibleMessageRows(rows, 'profile-current');

    expect(result.map((row) => row.id)).toEqual([
      'all',
      'legacy-null',
      'legacy-undefined',
    ]);
    expect(result.map((row) => row.marker)).toEqual([1, 2, 3]);
    expect(result[0]).toBe(rows[0]);
  });

  it('keeps targeted rows only for an explicitly allowed profile', () => {
    const allowed = makeRow({
      id: 'allowed',
      visibility_type: 'specific-users',
      visibility_user_ids: ['profile-current', 'profile-other'],
    });
    const denied = makeRow({
      id: 'denied',
      visibility_type: 'specific-users',
      visibility_user_ids: ['profile-other'],
    });

    expect(filterVisibleMessageRows([allowed, denied], 'profile-current')).toEqual([
      allowed,
    ]);
  });

  it('fails closed for targeted rows when profile context or the allow-list is absent', () => {
    const targeted = makeRow({
      visibility_type: 'specific-users',
      visibility_user_ids: null,
    });

    expect(filterVisibleMessageRows([targeted])).toEqual([]);
    expect(filterVisibleMessageRows([targeted], 'profile-current')).toEqual([]);
  });
});
