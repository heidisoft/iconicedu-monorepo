import { describe, expect, it, vi } from 'vitest';

import {
  listActiveSupportStaffProfileIds,
  markSupportStaffVolunteerAssignment,
  seedRequiredSupportThreadAssignments,
} from './support-thread-staffing';

describe('listActiveSupportStaffProfileIds', () => {
  it('returns deduped staff profile ids from profile kind and role mappings', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-1', account_id: 'account-1' }],
                      error: null,
                    })),
                  })),
                })),
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-1' }, { id: 'staff-profile-2' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ account_id: 'account-2' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as never;

    const result = await listActiveSupportStaffProfileIds(supabase, 'org-1');

    expect(result).toEqual(
      expect.arrayContaining(['staff-profile-1', 'staff-profile-2']),
    );
    expect(result).toHaveLength(2);
  });
});

describe('support thread assignments', () => {
  it('seeds required assignments for all active staff', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-1', account_id: 'account-1' }],
                      error: null,
                    })),
                  })),
                })),
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-2' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ account_id: 'account-2' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'support_thread_assignments') {
          return { upsert };
        }
        return {};
      }),
    } as never;

    await seedRequiredSupportThreadAssignments({
      supabase,
      orgId: 'org-1',
      threadId: 'thread-1',
      assignedByProfileId: 'actor-1',
      now: '2026-03-17T00:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: 'thread-1',
          staff_profile_id: 'staff-profile-1',
          assignment_kind: 'required',
        }),
        expect.objectContaining({
          thread_id: 'thread-1',
          staff_profile_id: 'staff-profile-2',
          assignment_kind: 'required',
        }),
      ]),
      { onConflict: 'org_id,thread_id,staff_profile_id', ignoreDuplicates: true },
    );
  });

  it('marks volunteer staff replies as optional assignment', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'support_thread_assignments') {
          return { upsert };
        }
        return {};
      }),
    } as never;

    await markSupportStaffVolunteerAssignment({
      supabase,
      orgId: 'org-1',
      threadId: 'thread-1',
      staffProfileId: 'staff-profile-3',
      assignedByProfileId: 'staff-profile-3',
      now: '2026-03-17T00:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          thread_id: 'thread-1',
          staff_profile_id: 'staff-profile-3',
          assignment_kind: 'optional',
        }),
      ],
      { onConflict: 'org_id,thread_id,staff_profile_id', ignoreDuplicates: true },
    );
  });
});
