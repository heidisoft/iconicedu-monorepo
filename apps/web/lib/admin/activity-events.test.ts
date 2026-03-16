import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminActivityEventRows } from '@iconicedu/web/lib/admin/activity-events';

const createSupabaseServerClient = vi.fn();
const getProfilesByIds = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

describe('getAdminActivityEventRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads activity events with actor and scope labels', async () => {
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: async () => ({
                    data: [
                      {
                        id: 'event-1',
                        org_id: 'org-1',
                        event_type: 'class.created',
                        occurred_at: '2026-03-03T10:00:00.000Z',
                        source_kind: 'profile',
                        actor_profile_id: 'profile-1',
                        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
                        object_ref: { kind: 'learning_space', id: 'space-1' },
                        target_ref: { kind: 'channel', id: 'channel-1' },
                        payload: {},
                        audience_rules: [],
                        dedupe_key: 'class.created:space-1',
                        projection_status: 'failed',
                        projection_attempts: 2,
                        last_projection_error: 'boom',
                        created_at: '2026-03-03T10:00:00.000Z',
                        updated_at: '2026-03-03T10:00:00.000Z',
                      },
                      {
                        id: 'event-2',
                        org_id: 'org-1',
                        event_type: 'system.notice',
                        occurred_at: '2026-03-03T09:00:00.000Z',
                        source_kind: 'system',
                        actor_profile_id: null,
                        scope: { kind: 'org' },
                        object_ref: null,
                        target_ref: null,
                        payload: {},
                        audience_rules: [],
                        dedupe_key: null,
                        projection_status: 'projected',
                        projection_attempts: 1,
                        last_projection_error: null,
                        created_at: '2026-03-03T09:00:00.000Z',
                        updated_at: '2026-03-03T09:00:00.000Z',
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    getProfilesByIds.mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          org_id: 'org-1',
          account_id: 'account-1',
          kind: 'educator',
          display_name: 'Jane Educator',
          first_name: 'Jane',
          last_name: 'Educator',
        },
      ],
    });

    const rows = await getAdminActivityEventRows('org-1');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      actorDisplayName: 'Jane Educator',
      scopeLabel: 'learning_space:space-1',
      objectLabel: 'learning_space:space-1',
      targetLabel: 'channel:channel-1',
    });
    expect(rows[1]).toMatchObject({
      actorDisplayName: 'System',
      scopeLabel: 'org',
    });
    expect(getProfilesByIds).toHaveBeenCalledWith(expect.anything(), 'org-1', [
      'profile-1',
    ]);
  });
});
