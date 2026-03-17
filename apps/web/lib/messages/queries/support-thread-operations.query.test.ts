import { describe, expect, it, vi } from 'vitest';

import { listSupportThreadReplyCoverage } from './support-thread-operations.query';

describe('listSupportThreadReplyCoverage', () => {
  it('returns pending staff per thread', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'threads') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'thread-1', parent_message_id: 'parent-1' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-1', account_id: 'staff-account-1' }],
                      error: null,
                    })),
                  })),
                })),
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'staff-profile-2', account_id: 'staff-account-2' }],
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
                      data: [{ account_id: 'staff-account-2' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'messages') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    is: vi.fn(() => ({
                      returns: vi.fn(async () => ({
                        data: [
                          {
                            id: 'reply-1',
                            thread_id: 'thread-1',
                            thread_parent_id: 'parent-1',
                            sender_profile_id: 'staff-profile-1',
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
                })),
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [{ id: 'parent-1', sender_profile_id: 'owner-profile-1' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'support_thread_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [
                        {
                          thread_id: 'thread-1',
                          staff_profile_id: 'staff-profile-2',
                          assignment_kind: 'optional',
                        },
                      ],
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

    const result = await listSupportThreadReplyCoverage(supabase, {
      orgId: 'org-1',
      channelId: 'support-channel',
    });

    expect(result).toEqual([
      {
        threadId: 'thread-1',
        questionOwnerProfileId: 'owner-profile-1',
        staffProfileIds: expect.arrayContaining(['staff-profile-1', 'staff-profile-2']),
        requiredStaffProfileIds: expect.arrayContaining([
          'staff-profile-1',
          'staff-profile-2',
        ]),
        repliedStaffProfileIds: ['staff-profile-1'],
        pendingRequiredStaffProfileIds: ['staff-profile-2'],
        volunteerStaffProfileIds: [],
      },
    ]);
  });
});
