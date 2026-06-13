import { publishUnviewedClassroomMessageActivity } from '@iconicedu/api/lib/messages/message-activity';

type TableData = Record<string, unknown[]>;

function makeSupabase(data: TableData) {
  const calls: Array<{ table: string; method: string; payload?: unknown }> = [];

  function makeQuery(table: string) {
    const filters = new Map<string, unknown>();
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((column: string, value: unknown) => {
        filters.set(column, value);
        return query;
      }),
      in: jest.fn((column: string, value: unknown) => {
        filters.set(column, value);
        return query;
      }),
      is: jest.fn(() => query),
      maybeSingle: jest.fn(async () => {
        calls.push({
          table,
          method: 'maybeSingle',
          payload: Object.fromEntries(filters),
        });
        return { data: (data[table] ?? [])[0] ?? null, error: null };
      }),
      returns: jest.fn(async () => {
        calls.push({ table, method: 'returns', payload: Object.fromEntries(filters) });
        return { data: data[table] ?? [], error: null };
      }),
    };
    return query;
  }

  return {
    calls,
    from: jest.fn((table: string) => makeQuery(table)),
  };
}

describe('publishUnviewedClassroomMessageActivity', () => {
  const message = {
    id: 'message-1',
    org_id: 'org-1',
    channel_id: 'channel-1',
    sender_profile_id: 'guardian-1',
    created_at: '2026-06-01T10:00:00.000Z',
    type: 'text',
    visibility_type: 'all',
    visibility_user_id: null,
    visibility_user_ids: null,
    thread_id: null,
    thread_parent_id: null,
    sender: {
      id: 'guardian-1',
      account_id: 'account-guardian-1',
      kind: 'guardian',
      display_name: 'Ari Parent',
    },
  };
  const channel = {
    id: 'channel-1',
    kind: 'classroom',
    topic: 'Algebra I',
    purpose: 'classroom',
    visibility: 'private',
    primary_entity_kind: 'learning_space',
    primary_entity_id: 'space-1',
  };

  it('publishes to staff when an intended participant has not viewed a classroom message after the threshold', async () => {
    const publishActivity = jest.fn(async () => null);
    const supabase = makeSupabase({
      messages: [message],
      channels: [channel],
      channel_members: [
        {
          profile: {
            id: 'guardian-1',
            account_id: 'account-guardian-1',
            kind: 'guardian',
            display_name: 'Ari Parent',
          },
        },
        {
          profile: {
            id: 'teacher-1',
            account_id: 'account-teacher-1',
            kind: 'educator',
            display_name: 'Ms. Chen',
          },
        },
      ],
      channel_read_state: [
        {
          account_id: 'account-teacher-1',
          last_read_at: '2026-06-01T09:00:00.000Z',
        },
      ],
      profiles: [{ id: 'staff-1' }],
    });

    const result = await publishUnviewedClassroomMessageActivity({
      supabase: supabase as never,
      readSupabase: supabase as never,
      publishActivity: publishActivity as never,
      orgId: 'org-1',
      messageId: 'message-1',
      now: '2026-06-01T14:01:00.000Z',
    });

    expect(result).toMatchObject({
      suppressed: false,
      unviewedParticipantCount: 1,
      staffRecipientCount: 1,
    });
    expect(publishActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message.unviewed_intended_participants',
        audienceRules: [{ kind: 'users_only', userIds: ['staff-1'] }],
        payload: expect.objectContaining({
          senderName: 'Ari Parent',
          unviewedParticipantIds: ['teacher-1'],
          unviewedParticipantNames: ['Ms. Chen'],
          thresholdHours: 4,
        }),
      }),
    );
  });

  it('suppresses the staff activity before the configured threshold', async () => {
    const publishActivity = jest.fn(async () => null);
    const supabase = makeSupabase({
      messages: [message],
      channels: [channel],
    });

    const result = await publishUnviewedClassroomMessageActivity({
      supabase: supabase as never,
      readSupabase: supabase as never,
      publishActivity: publishActivity as never,
      orgId: 'org-1',
      messageId: 'message-1',
      now: '2026-06-01T13:59:00.000Z',
    });

    expect(result).toEqual({
      suppressed: true,
      reason: 'threshold_not_reached',
    });
    expect(publishActivity).not.toHaveBeenCalled();
  });

  it('suppresses the staff activity when intended participants have read the message', async () => {
    const publishActivity = jest.fn(async () => null);
    const supabase = makeSupabase({
      messages: [message],
      channels: [channel],
      channel_members: [
        {
          profile: {
            id: 'teacher-1',
            account_id: 'account-teacher-1',
            kind: 'educator',
            display_name: 'Ms. Chen',
          },
        },
      ],
      channel_read_state: [
        {
          account_id: 'account-teacher-1',
          last_read_at: '2026-06-01T10:05:00.000Z',
        },
      ],
      profiles: [{ id: 'staff-1' }],
    });

    const result = await publishUnviewedClassroomMessageActivity({
      supabase: supabase as never,
      readSupabase: supabase as never,
      publishActivity: publishActivity as never,
      orgId: 'org-1',
      messageId: 'message-1',
      now: '2026-06-02T10:01:00.000Z',
    });

    expect(result).toEqual({
      suppressed: true,
      reason: 'all_intended_participants_viewed',
    });
    expect(publishActivity).not.toHaveBeenCalled();
  });
});
