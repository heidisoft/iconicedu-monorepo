import { describe, expect, it } from 'vitest';

import {
  buildDashboardClassRequestMessage,
  createPrivateClassRequestChannel,
  listClassRequestRecipientProfiles,
} from './class-request';

describe('dashboard class request helpers', () => {
  it('builds class request message with custom other subject', () => {
    const message = buildDashboardClassRequestMessage({
      requesterName: 'Riley Morgan',
      requestIntent: 'trial-class',
      studentNames: ['Maya Morgan'],
      subjects: ['Math', 'Other'],
      otherSubject: 'Robotics',
      learningGoals: 'Fractions and algebra basics',
      specialRequirements: 'Visual aids',
    });

    expect(message).toContain('Requested by: Riley Morgan');
    expect(message).toContain('Request type: Trial class');
    expect(message).toContain('Student(s): Maya Morgan');
    expect(message).toContain('Subject(s): Math, Robotics');
    expect(message).toContain('Learning goals:\nFractions and algebra basics');
  });

  it('creates a private channel with requester as a member even when no staff exists', async () => {
    const inserts: Array<{ table: string; payload: unknown }> = [];

    const supabase = {
      from: (table: string) => {
        if (table === 'channels') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        is: () => ({
                          order: () => ({
                            limit: async () => ({ data: [], error: null }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async (payload: unknown) => {
              inserts.push({ table, payload });
              return { error: null };
            },
          };
        }

        if (table === 'channel_members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: async () => ({ data: [], error: null }),
                }),
              }),
            }),
            insert: async (payload: unknown) => {
              inserts.push({ table, payload });
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    } as never;

    const result = await createPrivateClassRequestChannel({
      supabase,
      orgId: 'org-1',
      requesterProfile: {
        id: 'guardian-1',
      } as never,
      staffProfiles: [],
      topic: 'Class Request',
      nowIso: '2026-03-14T12:00:00.000Z',
    });

    expect(result.channelId).toBeTruthy();
    expect(inserts[0]?.table).toBe('channels');
    expect(inserts[0]?.payload).toEqual(
      expect.objectContaining({
        kind: 'channel',
        purpose: 'chass-requests',
        ui_defaults: {
          defaultRightPanelOpen: false,
          defaultRightPanelKey: 'channel_info',
          disabledTabs: ['members'],
          infoPanel: {
            showHeader: false,
            showDetails: false,
            showMedia: false,
            showMembers: false,
            showQuickActions: false,
            showHiddenQuickActions: false,
          },
        },
      }),
    );
    expect(inserts[1]?.table).toBe('channel_members');
    expect(inserts[1]?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: 'guardian-1',
        }),
      ]),
    );
  });

  it('omits learning goals section when not provided', () => {
    const message = buildDashboardClassRequestMessage({
      requesterName: 'Riley Morgan',
      requestIntent: 'ongoing-tutoring',
      studentNames: ['Maya Morgan'],
      subjects: ['Math'],
      specialRequirements: null,
    });

    expect(message).not.toContain('Learning goals:');
  });

  it('includes urgent homework details in the staff message', () => {
    const message = buildDashboardClassRequestMessage({
      requesterName: 'Riley Morgan',
      requestIntent: 'urgent-homework-help',
      studentNames: ['Maya Morgan'],
      subjects: ['Math'],
      learningGoals: 'Geometry worksheet due Friday at 3pm',
      specialRequirements: null,
    });

    expect(message).toContain('Request type: Urgent homework help');
    expect(message).toContain('Geometry worksheet due Friday at 3pm');
  });

  it('reuses existing class-request channel and appends missing staff members only', async () => {
    const inserts: Array<{ table: string; payload: unknown }> = [];

    const supabase = {
      from: (table: string) => {
        if (table === 'channels') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        is: () => ({
                          order: () => ({
                            limit: async () => ({
                              data: [{ id: 'existing-channel-1' }],
                              error: null,
                            }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async (payload: unknown) => {
              inserts.push({ table, payload });
              return { error: null };
            },
          };
        }

        if (table === 'channel_members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: async () => ({
                    data: [{ profile_id: 'guardian-1' }, { profile_id: 'staff-1' }],
                    error: null,
                  }),
                }),
              }),
            }),
            insert: async (payload: unknown) => {
              inserts.push({ table, payload });
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    } as never;

    const result = await createPrivateClassRequestChannel({
      supabase,
      orgId: 'org-1',
      requesterProfile: { id: 'guardian-1' } as never,
      staffProfiles: [{ id: 'staff-1' }, { id: 'staff-2' }] as never,
      topic: 'Class Requests · Riley Morgan',
      nowIso: '2026-03-14T12:00:00.000Z',
    });

    expect(result.channelId).toBe('existing-channel-1');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.table).toBe('channel_members');
    expect(inserts[0]?.payload).toEqual([
      expect.objectContaining({
        channel_id: 'existing-channel-1',
        profile_id: 'staff-2',
      }),
    ]);
  });

  it('lists staff plus admin and owner role profiles as class request recipients', async () => {
    const profileResponses = [
      { data: [{ id: 'staff-profile-1' }], error: null },
      {
        data: [{ id: 'admin-profile-1' }, { id: 'staff-profile-1' }],
        error: null,
      },
    ];
    const supabase = {
      from: (table: string) => {
        if (table === 'profiles') {
          const chain = {
            eq: () => chain,
            in: () => chain,
            is: () => chain,
            returns: async () => profileResponses.shift() ?? { data: [], error: null },
          };
          return {
            select: () => chain,
          };
        }

        if (table === 'user_roles') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  is: () => ({
                    returns: async () => ({
                      data: [{ account_id: 'admin-account-1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  is: () => ({
                    returns: async () => ({
                      data: [{ id: 'owner-account-1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    } as never;

    const recipients = await listClassRequestRecipientProfiles({
      supabase,
      orgId: 'org-1',
    });

    expect(recipients.map((profile) => profile.id)).toEqual([
      'staff-profile-1',
      'admin-profile-1',
    ]);
  });
});
