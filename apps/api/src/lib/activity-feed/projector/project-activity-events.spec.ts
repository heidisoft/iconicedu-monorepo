import type { ActivityEventRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';

function makeProfile(input: {
  id: string;
  account_id: string;
  kind: string;
  display_name: string;
}) {
  return {
    org_id: 'org-1',
    avatar_source: 'generated',
    created_at: '2026-05-05T00:00:00.000Z',
    updated_at: '2026-05-05T00:00:00.000Z',
    ...input,
  } as ProfileRow;
}

function makeEvent(): ActivityEventRow {
  return {
    id: 'event-1',
    org_id: 'org-1',
    event_type: 'session.reminder.sent',
    occurred_at: '2026-05-05T12:00:00.000Z',
    source_kind: 'system',
    actor_profile_id: null,
    scope: { kind: 'global' },
    object_ref: null,
    target_ref: null,
    payload: {
      title: 'Algebra I',
      summary: 'Class starts in 30 minutes',
      channelId: 'channel-1',
      channelRouteKind: 'space',
      members: [
        {
          profileId: 'teacher-1',
          role: 'educator',
          displayName: 'Ms. Chen',
        },
        {
          profileId: 'student-1',
          role: 'child',
          displayName: 'Priya',
        },
      ],
    },
    audience_rules: [{ kind: 'users_only', userIds: ['guardian-1', 'teacher-1'] }],
    dedupe_key: 'reminder-1:activity',
    projection_status: 'pending',
    projection_attempts: 0,
    created_at: '2026-05-05T12:00:00.000Z',
    updated_at: '2026-05-05T12:00:00.000Z',
  };
}

function makeSupabase(event: ActivityEventRow) {
  const teacher = makeProfile({
    id: 'teacher-1',
    account_id: 'account-teacher-1',
    kind: 'educator',
    display_name: 'Ms. Chen',
  });
  const student = makeProfile({
    id: 'student-1',
    account_id: 'account-student-1',
    kind: 'child',
    display_name: 'Priya',
  });
  const guardian = makeProfile({
    id: 'guardian-1',
    account_id: 'account-guardian-1',
    kind: 'guardian',
    display_name: 'Anika Rao',
  });
  const profiles = [teacher, student, guardian];
  const upsertedRows: Record<string, unknown>[] = [];

  const supabase = {
    rpc: jest.fn(async () => ({ data: { id: 'job-1' }, error: null })),
    from: jest.fn((table: string) => {
      const filters = new Map<string, unknown>();
      let upsertRow: Record<string, unknown> | null = null;
      const query = {
        select: jest.fn(() => query),
        update: jest.fn(() => query),
        upsert: jest.fn((row: Record<string, unknown>) => {
          upsertRow = row;
          upsertedRows.push(row);
          return query;
        }),
        single: jest.fn(async () => ({
          data: { id: upsertRow?.id ?? 'item-1' },
          error: null,
        })),
        eq: jest.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        }),
        in: jest.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        }),
        is: jest.fn(() => query),
        lt: jest.fn(() => query),
        order: jest.fn(() => query),
        limit: jest.fn(() => query),
        returns: jest.fn(async () => {
          if (table === 'activity_events') {
            return { data: [event], error: null };
          }
          if (table === 'profiles') {
            const idFilter = filters.get('id');
            const accountFilter = filters.get('account_id');
            if (Array.isArray(idFilter)) {
              return {
                data: profiles.filter((profile) => idFilter.includes(profile.id)),
                error: null,
              };
            }
            if (Array.isArray(accountFilter)) {
              return {
                data: profiles.filter((profile) =>
                  accountFilter.includes(profile.account_id),
                ),
                error: null,
              };
            }
            return { data: profiles, error: null };
          }
          if (table === 'learning_space_participants') {
            return { data: [], error: null };
          }
          if (table === 'family_links') {
            return {
              data: [
                {
                  guardian_account_id: 'account-guardian-1',
                  child_account_id: 'account-student-1',
                },
              ],
              error: null,
            };
          }
          if (table === 'user_roles') {
            return { data: [], error: null };
          }
          return { data: [], error: null };
        }),
      };
      return query;
    }),
  } as unknown as SupabaseServiceClient;

  return { supabase, upsertedRows };
}

describe('projectActivityEvents context rendering', () => {
  it('renders different context for different recipients from one event', async () => {
    const { supabase, upsertedRows } = makeSupabase(makeEvent());

    await projectActivityEvents(supabase, { eventIds: ['event-1'], limit: 1 });

    expect(upsertedRows).toHaveLength(2);
    const guardianRow = upsertedRows.find(
      (row) => row.recipient_profile_id === 'guardian-1',
    );
    const teacherRow = upsertedRows.find(
      (row) => row.recipient_profile_id === 'teacher-1',
    );

    expect((guardianRow?.content as Record<string, unknown>).summary).toBe(
      'Algebra I for Priya with Ms. Chen Class starts in 30 minutes',
    );
    expect((teacherRow?.content as Record<string, unknown>).summary).toBe(
      'Algebra I with Priya Class starts in 30 minutes',
    );
  });
});
