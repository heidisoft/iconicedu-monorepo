import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClientMock = vi.fn();
const createSupabaseServiceClientMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdInOrgMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrgMock(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { cancelClassScheduleSessionAction } from './cancel-class-schedule-session';

function createServerSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'auth-1' },
        },
      })),
    },
  };
}

function createRecurringServiceSupabase() {
  const deleteOverride = vi.fn(async () => ({ error: null }));
  const insertException = vi.fn(async () => ({ error: null }));

  return {
    deleteOverride,
    insertException,
    from: vi.fn((table: string) => {
      if (table === 'class_schedules') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'schedule-1', org_id: 'org-1' },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'class_schedule_recurrence') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'recurrence-1' },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'class_schedule_recurrence_overrides') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: deleteOverride,
              })),
            })),
          })),
        };
      }

      if (table === 'class_schedule_recurrence_exceptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          insert: insertException,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createSingleServiceSupabase() {
  const updateSchedule = vi.fn(async () => ({ error: null }));

  return {
    updateSchedule,
    from: vi.fn((table: string) => {
      if (table === 'class_schedules') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: 'schedule-1', org_id: 'org-1' },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: updateSchedule,
              })),
            })),
          })),
        };
      }

      if (table === 'class_schedule_recurrence') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
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

describe('cancelClassScheduleSessionAction', () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    createSupabaseServiceClientMock.mockReset();
    buildOrgBySlugMock.mockReset();
    getAccountByAuthUserIdInOrgMock.mockReset();
    revalidatePathMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue(createServerSupabase());
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'owner' },
    });
  });

  it('creates a recurrence exception and removes any matching override for recurring sessions', async () => {
    const serviceSupabase = createRecurringServiceSupabase();
    createSupabaseServiceClientMock.mockReturnValue(serviceSupabase);

    const result = await cancelClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: ' Tutor unavailable ',
    });

    expect(serviceSupabase.deleteOverride).toHaveBeenCalledWith(
      'occurrence_key',
      '2026-03-21T10:00:00.000Z',
    );
    expect(serviceSupabase.insertException).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        recurrence_id: 'recurrence-1',
        occurrence_key: '2026-03-21T10:00:00.000Z',
        reason: 'Tutor unavailable',
        created_by: 'account-1',
        updated_by: 'account-1',
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: 'Tutor unavailable',
      mode: 'recurring',
    });
  });

  it('updates single schedules directly when no recurrence exists', async () => {
    const serviceSupabase = createSingleServiceSupabase();
    createSupabaseServiceClientMock.mockReturnValue(serviceSupabase);

    const result = await cancelClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
    });

    expect(serviceSupabase.updateSchedule).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
      mode: 'single',
    });
  });

  it('rejects non-staff non-owner profiles', async () => {
    createSupabaseServiceClientMock.mockReturnValue(createSingleServiceSupabase());
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'guardian' },
    });

    await expect(
      cancelClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T10:00:00.000Z',
      }),
    ).rejects.toThrow('Only staff or owner users can cancel sessions.');
  });
});
