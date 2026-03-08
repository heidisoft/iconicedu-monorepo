import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAdminAuthContextMock,
  createSupabaseServiceClientMock,
  ensureSystemProfileIdMock,
  publishActivityEventMock,
} = vi.hoisted(() => ({
  requireAdminAuthContextMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  ensureSystemProfileIdMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: requireAdminAuthContextMock,
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/automation/system-profile', () => ({
  ensureSystemProfileId: ensureSystemProfileIdMock,
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

import { archiveLearningSpace } from '@iconicedu/web/lib/admin/learning-space-archive';

describe('archiveLearningSpace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const learningSpacesUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(async () => ({ error: null })),
        })),
      })),
    }));

    requireAdminAuthContextMock.mockResolvedValue({
      orgId: 'org-1',
      profileId: 'profile-admin-1',
      now: '2026-03-08T14:00:00.000Z',
      supabase: {
        from: vi.fn((table: string) => {
          if (table === 'learning_spaces') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: 'space-1', title: 'Math Foundations' },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
              update: learningSpacesUpdate,
            };
          }

          if (table === 'learning_space_channels') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: { channel_id: 'channel-1' },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      },
    });
    createSupabaseServiceClientMock.mockReturnValue({});
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
  });

  it('archives the learning space and publishes a system archive activity', async () => {
    await archiveLearningSpace('space-1');

    expect(ensureSystemProfileIdMock).toHaveBeenCalled();
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.archived',
        sourceKind: 'system',
        actorProfileId: 'system-profile-1',
        payload: expect.objectContaining({
          title: 'Math Foundations',
          channelId: 'channel-1',
          archivedAt: '2026-03-08T14:00:00.000Z',
        }),
      }),
    );
  });
});
