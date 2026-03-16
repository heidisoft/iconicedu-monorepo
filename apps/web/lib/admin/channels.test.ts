import { describe, expect, it } from 'vitest';

import {
  filterDirectMessageChannels,
  type AdminChannelRow,
} from '@iconicedu/web/lib/admin/channels';

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
  participantCount: 0,
  participantDetails: [],
};

describe('filterDirectMessageChannels', () => {
  it('returns only dm and group_dm rows', () => {
    const rows: AdminChannelRow[] = [
      baseRow,
      { ...baseRow, id: 'channel-2', kind: 'dm' },
      { ...baseRow, id: 'channel-3', kind: 'group_dm' },
    ];

    const filtered = filterDirectMessageChannels(rows);

    expect(filtered.map((row) => row.id)).toEqual(['channel-2', 'channel-3']);
  });
});
