import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';

const projectActivityEvents = vi.fn();
const resolveActivityVerbSuppressionDecision = vi.fn();

vi.mock('@iconicedu/web/lib/activity-feed/projector/project-activity-events', () => ({
  projectActivityEvents: (...args: unknown[]) => projectActivityEvents(...args),
}));

vi.mock('@iconicedu/web/lib/activity-feed/suppression/activity-verb-suppression', () => ({
  resolveActivityVerbSuppressionDecision: (...args: unknown[]) =>
    resolveActivityVerbSuppressionDecision(...args),
  isActivityVerbSuppressionDebugEnabled: () => false,
}));

describe('publishActivityEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActivityVerbSuppressionDecision.mockResolvedValue({
      shouldPublish: true,
      source: 'default',
    });
  });

  it('inserts event and immediately attempts projection', async () => {
    const insertSingle = vi.fn(async () => ({
      data: {
        id: 'event-1',
        org_id: 'org-1',
        dedupe_key: 'dedupe-1',
      },
      error: null,
    }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: insertSingle,
      })),
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orgs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'org-1', slug: 'iconic-academy' },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          insert,
        };
      }),
    };

    projectActivityEvents.mockResolvedValue({ processed: 1 });

    const result = await publishActivityEvent({
      supabase: supabase as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-1' },
      dedupeKey: 'dedupe-1',
    });

    expect(result?.id).toBe('event-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          messageId: 'message-1',
          orgSlug: 'iconic-academy',
        }),
      }),
    );
    expect(projectActivityEvents).toHaveBeenCalledWith(supabase, {
      eventIds: ['event-1'],
      limit: 1,
    });
  });

  it('returns inserted event even when immediate projection fails', async () => {
    const insertSingle = vi.fn(async () => ({
      data: {
        id: 'event-2',
        org_id: 'org-1',
        dedupe_key: 'dedupe-2',
      },
      error: null,
    }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: insertSingle,
      })),
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orgs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'org-1', slug: 'iconic-academy' },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          insert,
        };
      }),
    };

    projectActivityEvents.mockRejectedValue(new Error('projection failed'));

    const result = await publishActivityEvent({
      supabase: supabase as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-2' },
      dedupeKey: 'dedupe-2',
    });

    expect(result?.id).toBe('event-2');
  });

  it('returns existing event on dedupe conflict', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orgs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'org-1', slug: 'iconic-academy' },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        if (table !== 'activity_events') {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: { code: '23505', message: 'duplicate key value' },
              })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: 'event-existing',
                      org_id: 'org-1',
                      dedupe_key: 'dedupe-existing',
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }),
    };

    const result = await publishActivityEvent({
      supabase: supabase as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-3' },
      dedupeKey: 'dedupe-existing',
    });

    expect(result?.id).toBe('event-existing');
    expect(projectActivityEvents).not.toHaveBeenCalled();
  });

  it('returns null and skips insert when event type is suppressed', async () => {
    resolveActivityVerbSuppressionDecision.mockResolvedValueOnce({
      shouldPublish: false,
      source: 'org',
      rule: { id: 'rule-1', is_enabled: false },
    });

    const supabase = {
      from: vi.fn(),
    };

    const result = await publishActivityEvent({
      supabase: supabase as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-4' },
      dedupeKey: 'dedupe-4',
    });

    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(projectActivityEvents).not.toHaveBeenCalled();
  });
});
