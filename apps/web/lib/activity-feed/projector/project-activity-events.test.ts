import { beforeEach, describe, expect, it, vi } from 'vitest';

import { projectActivityEvents } from '@iconicedu/web/lib/activity-feed/projector/project-activity-events';

const getFamilyLinksByOrg = vi.fn();
const getProfilesByIds = vi.fn();
const getProfilesByAccountIds = vi.fn();

vi.mock('@iconicedu/web/lib/family/queries/families.query', () => ({
  getFamilyLinksByOrg: (...args: unknown[]) => getFamilyLinksByOrg(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
  getProfilesByAccountIds: (...args: unknown[]) => getProfilesByAccountIds(...args),
}));

function createSupabaseMock() {
  const events = [
    {
      id: 'event-1',
      org_id: 'org-1',
      event_type: 'class.created',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'educator-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Algebra I',
        subject: 'Math',
      },
      audience_rules: [],
      dedupe_key: 'class.created:space-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    },
  ];
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'activity_events') {
        return {
          select: vi.fn(() => ({
            is: vi.fn(() => ({
              lt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    in: vi.fn(() => ({
                      returns: vi.fn(async () => ({ data: events, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => {
                updates.push({ table, payload });
                return { error: null };
              }),
            })),
          })),
        };
      }

      if (table === 'learning_space_participants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [{ profile_id: 'child-profile-1' }, { profile_id: 'educator-profile-1' }],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'activity_feed_items') {
        return {
          upsert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                upserts.push({ table, payload });
                return { data: { id: 'feed-item-1' }, error: null };
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(async () => {
              updates.push({ table, payload });
              return { error: null };
            }),
          })),
        };
      }

      if (table === 'activity_feed_group_members') {
        return {
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            upserts.push({ table, payload });
            return { error: null };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({ count: 1, error: null })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { supabase, updates, upserts };
}

describe('projectActivityEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfilesByIds.mockResolvedValue({
      data: [{ id: 'child-profile-1', account_id: 'child-account-1', kind: 'child' }],
    });
    getFamilyLinksByOrg.mockResolvedValue({
      data: [{ guardian_account_id: 'guardian-account-1', child_account_id: 'child-account-1' }],
    });
    getProfilesByAccountIds.mockResolvedValue({
      data: [{ id: 'guardian-profile-1', account_id: 'guardian-account-1', kind: 'guardian' }],
    });
  });

  it('projects class events to participants and guardian recipients', async () => {
    const { supabase, updates, upserts } = createSupabaseMock();

    const result = await projectActivityEvents(supabase as never);

    expect(result).toEqual({ processed: 1 });
    const itemUpserts = upserts.filter((entry) => entry.table === 'activity_feed_items');
    expect(itemUpserts).toHaveLength(2);
    expect(itemUpserts.map((entry) => entry.payload.recipient_profile_id)).toEqual(
      expect.arrayContaining(['child-profile-1', 'guardian-profile-1']),
    );
    expect(itemUpserts.map((entry) => entry.payload.recipient_profile_id)).not.toContain(
      'educator-profile-1',
    );
    expect(itemUpserts[0]?.payload.action_button).toEqual({
      label: 'Open class',
      variant: 'outline',
      href: '../spaces/channel-1',
    });
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'activity_events',
          payload: expect.objectContaining({ projection_status: 'processing' }),
        }),
        expect.objectContaining({
          table: 'activity_events',
          payload: expect.objectContaining({ projection_status: 'projected' }),
        }),
      ]),
    );
  });
});
