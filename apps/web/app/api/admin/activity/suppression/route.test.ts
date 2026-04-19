import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from './route';

const requireAdminOrgContext = vi.fn();
const createSupabaseServiceClient = vi.fn();
const listActivityEventDefinitionTypes = vi.fn();

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClient(...args),
}));

vi.mock('@iconicedu/api/lib/activity-feed/definitions/activity-definitions', () => ({
  listActivityEventDefinitionTypes: (...args: unknown[]) =>
    listActivityEventDefinitionTypes(...args),
}));

function createServiceSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'activity_event_suppression_rules') {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          is: vi.fn(() => selectChain),
          order: vi.fn(() => selectChain),
          returns: vi.fn(async () => ({
            data: [
              {
                id: 'rule-1',
                org_id: 'org-1',
                event_type: 'message.posted',
                actor_profile_id: null,
                is_enabled: false,
                created_at: '2026-03-09T12:00:00.000Z',
                updated_at: '2026-03-09T12:00:00.000Z',
              },
            ],
            error: null,
          })),
        };

        const updateChain = {
          eq: vi.fn(() => updateChain),
          is: vi.fn(() => updateChain),
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: null,
            })),
          })),
        };

        return {
          select: vi.fn(() => selectChain),
          update: vi.fn(() => updateChain),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'rule-2',
                  org_id: 'org-1',
                  event_type: 'dm.posted',
                  actor_profile_id: null,
                  is_enabled: false,
                  created_at: '2026-03-09T12:00:00.000Z',
                  updated_at: '2026-03-09T12:00:00.000Z',
                },
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [{ id: 'profile-2', display_name: 'Taylor User' }],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'activity_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [{ event_type: 'custom.imported' }],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('admin activity suppression route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-admin-1',
    });
    createSupabaseServiceClient.mockReturnValue(createServiceSupabaseMock());
    listActivityEventDefinitionTypes.mockReturnValue(['message.posted', 'dm.posted']);
  });

  it('GET returns suppression rules and a merged verb catalog', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/activity/suppression?orgId=org-1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.orgRules).toHaveLength(1);
    expect(payload.data.actorRules).toHaveLength(0);
    expect(payload.data.verbCatalog).toEqual(
      expect.arrayContaining([
        { eventType: 'message.posted', isKnown: true, isReadOnly: false },
        { eventType: 'custom.imported', isKnown: false, isReadOnly: true },
      ]),
    );
  });

  it('POST inserts a new org-level rule when no existing row matches', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/activity/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          eventType: 'dm.posted',
          actorProfileId: null,
          isEnabled: false,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.rule).toMatchObject({
      eventType: 'dm.posted',
      scope: 'org',
      isEnabled: false,
    });
  });
});
