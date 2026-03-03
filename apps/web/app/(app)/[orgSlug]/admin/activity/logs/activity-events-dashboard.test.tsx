import { describe, expect, it } from 'vitest';

import { filterActivityEventRows } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/logs/activity-events-dashboard';
import type { AdminActivityEventRow } from '@iconicedu/web/lib/admin/activity-events';

const makeRow = (overrides: Partial<AdminActivityEventRow>): AdminActivityEventRow => ({
  id: 'event-1',
  org_id: 'org-1',
  event_type: 'message.posted',
  occurred_at: '2026-03-03T10:00:00.000Z',
  source_kind: 'profile',
  actor_profile_id: 'profile-1',
  scope: { kind: 'channel', channelId: 'channel-1' },
  object_ref: null,
  target_ref: null,
  payload: {},
  audience_rules: [],
  dedupe_key: 'message.posted:channel-1',
  projection_status: 'failed',
  projection_attempts: 1,
  last_projection_error: 'Projection failed',
  created_at: '2026-03-03T10:00:00.000Z',
  updated_at: '2026-03-03T10:00:00.000Z',
  actorDisplayName: 'Jane Educator',
  scopeLabel: 'channel:channel-1',
  objectLabel: null,
  targetLabel: null,
  ...overrides,
});

describe('ActivityEventsDashboard', () => {
  it('filters rows by search input', async () => {
    const rows = [
      makeRow({ id: 'event-1', event_type: 'message.posted' }),
      makeRow({
        id: 'event-2',
        event_type: 'class.created',
        actorDisplayName: 'System',
        scopeLabel: 'learning_space:space-1',
      }),
    ];

    const filtered = filterActivityEventRows(rows, {
      search: 'space-1',
      statusFilter: 'all',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.event_type).toBe('class.created');
  });
});
