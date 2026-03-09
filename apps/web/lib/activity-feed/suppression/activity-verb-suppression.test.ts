import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveActivityVerbSuppressionDecision } from '@iconicedu/web/lib/activity-feed/suppression/activity-verb-suppression';

type RuleRow = {
  id: string;
  org_id: string;
  event_type: string;
  actor_profile_id: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

function createSupabaseMock(input: {
  actorRule?: RuleRow | null;
  orgRule?: RuleRow | null;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'activity_event_suppression_rules') {
        throw new Error(`Unexpected table ${table}`);
      }

      const chain = {
        eq: vi.fn((column: string, value: string) => {
          if (column === 'actor_profile_id') {
            (chain as { actorProfileId?: string | null }).actorProfileId = value;
          }
          return chain;
        }),
        is: vi.fn((column: string, value: null) => {
          if (column === 'actor_profile_id' && value === null) {
            (chain as { actorProfileId?: string | null }).actorProfileId = null;
          }
          return chain;
        }),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => {
          const actorProfileId = (chain as { actorProfileId?: string | null })
            .actorProfileId;
          if (actorProfileId === null) {
            return { data: input.orgRule ?? null, error: null };
          }
          return { data: input.actorRule ?? null, error: null };
        }),
      };

      return {
        select: vi.fn(() => chain),
      };
    }),
  };
}

describe('resolveActivityVerbSuppressionDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses with actor rule precedence', async () => {
    const decision = await resolveActivityVerbSuppressionDecision({
      supabase: createSupabaseMock({
        actorRule: {
          id: 'rule-actor',
          org_id: 'org-1',
          event_type: 'message.posted',
          actor_profile_id: 'profile-1',
          is_enabled: false,
          created_at: '2026-03-09T12:00:00.000Z',
          updated_at: '2026-03-09T12:00:00.000Z',
        },
        orgRule: {
          id: 'rule-org',
          org_id: 'org-1',
          event_type: 'message.posted',
          actor_profile_id: null,
          is_enabled: true,
          created_at: '2026-03-09T12:00:00.000Z',
          updated_at: '2026-03-09T12:00:00.000Z',
        },
      }) as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      actorProfileId: 'profile-1',
    });

    expect(decision.shouldPublish).toBe(false);
    expect(decision.source).toBe('actor');
  });

  it('uses org-level rule when actor override is missing', async () => {
    const decision = await resolveActivityVerbSuppressionDecision({
      supabase: createSupabaseMock({
        actorRule: null,
        orgRule: {
          id: 'rule-org',
          org_id: 'org-1',
          event_type: 'message.posted',
          actor_profile_id: null,
          is_enabled: false,
          created_at: '2026-03-09T12:00:00.000Z',
          updated_at: '2026-03-09T12:00:00.000Z',
        },
      }) as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      actorProfileId: 'profile-1',
    });

    expect(decision.shouldPublish).toBe(false);
    expect(decision.source).toBe('org');
  });

  it('defaults to publish when no suppression rule is found', async () => {
    const decision = await resolveActivityVerbSuppressionDecision({
      supabase: createSupabaseMock({
        actorRule: null,
        orgRule: null,
      }) as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      actorProfileId: 'profile-1',
    });

    expect(decision.shouldPublish).toBe(true);
    expect(decision.source).toBe('default');
  });
});
