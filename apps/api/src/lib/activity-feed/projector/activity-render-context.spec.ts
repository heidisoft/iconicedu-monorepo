import type { ActivityEventRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { resolveActivityRenderContext } from '@iconicedu/api/lib/activity-feed/projector/activity-render-context';

type MockData = {
  participants?: Array<{ profile_id: string }>;
  profiles?: Array<
    Partial<ProfileRow> & { id: string; account_id: string; kind: string }
  >;
  familyLinks?: Array<{ guardian_account_id: string; child_account_id: string }>;
  userRoles?: Array<{ account_id: string; role_key: string }>;
};

function makeProfile(
  input: Partial<ProfileRow> & {
    id: string;
    account_id: string;
    kind: string;
    display_name: string;
  },
) {
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
    event_type: 'message.posted',
    occurred_at: '2026-05-05T12:00:00.000Z',
    source_kind: 'system',
    actor_profile_id: null,
    scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
    object_ref: null,
    target_ref: { kind: 'learning_space', id: 'space-1' },
    payload: {
      learningSpaceId: 'space-1',
      title: 'Algebra I',
    },
    audience_rules: [],
    dedupe_key: 'event-1',
    projection_status: 'pending',
    projection_attempts: 0,
    created_at: '2026-05-05T12:00:00.000Z',
    updated_at: '2026-05-05T12:00:00.000Z',
  };
}

function makeSupabase(data: MockData) {
  return {
    from: jest.fn((table: string) => {
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
        returns: jest.fn(async () => {
          if (table === 'learning_space_participants') {
            return { data: data.participants ?? [], error: null };
          }
          if (table === 'profiles') {
            const idFilter = filters.get('id');
            const accountFilter = filters.get('account_id');
            const profiles = data.profiles ?? [];
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
          if (table === 'family_links') {
            const childAccountIds = filters.get('child_account_id');
            const familyLinks = data.familyLinks ?? [];
            return {
              data: Array.isArray(childAccountIds)
                ? familyLinks.filter((link) =>
                    childAccountIds.includes(link.child_account_id),
                  )
                : familyLinks,
              error: null,
            };
          }
          if (table === 'user_roles') {
            const accountId = filters.get('account_id');
            return {
              data: (data.userRoles ?? [])
                .filter((role) => role.account_id === accountId)
                .map((role) => ({ role_key: role.role_key })),
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      };
      return query;
    }),
  } as unknown as SupabaseServiceClient;
}

describe('resolveActivityRenderContext', () => {
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
  const secondStudent = makeProfile({
    id: 'student-2',
    account_id: 'account-student-2',
    kind: 'child',
    display_name: 'Mateo',
  });
  const guardian = makeProfile({
    id: 'guardian-1',
    account_id: 'account-guardian-1',
    kind: 'guardian',
    display_name: 'Anika Rao',
  });
  const staff = makeProfile({
    id: 'staff-1',
    account_id: 'account-staff-1',
    kind: 'staff',
    display_name: 'Admin User',
  });

  const baseData: MockData = {
    participants: [
      { profile_id: teacher.id },
      { profile_id: student.id },
      { profile_id: secondStudent.id },
    ],
    profiles: [teacher, student, secondStudent, guardian, staff],
    familyLinks: [
      {
        guardian_account_id: guardian.account_id,
        child_account_id: student.account_id,
      },
    ],
    userRoles: [{ account_id: staff.account_id, role_key: 'admin' }],
  };

  it('limits guardian context to linked students', async () => {
    const context = await resolveActivityRenderContext({
      supabase: makeSupabase(baseData),
      event: makeEvent(),
      recipientProfile: guardian,
    });

    expect(context.viewerStudentNames).toEqual(['Priya']);
    expect(context.studentNames).toEqual(['Priya', 'Mateo']);
    expect(context.teacherNames).toEqual(['Ms. Chen']);
  });

  it('gives teachers student and class context', async () => {
    const context = await resolveActivityRenderContext({
      supabase: makeSupabase(baseData),
      event: makeEvent(),
      recipientProfile: teacher,
    });

    expect(context.classTitle).toBe('Algebra I');
    expect(context.studentNames).toEqual(['Priya', 'Mateo']);
    expect(context.guardianNames).toEqual(['Anika Rao']);
  });

  it('detects admin/staff recipients from role keys and profile kind', async () => {
    const context = await resolveActivityRenderContext({
      supabase: makeSupabase(baseData),
      event: makeEvent(),
      recipientProfile: staff,
    });

    expect(context.viewerIsAdminStaff).toBe(true);
    expect(context.viewerRoleKeys).toEqual(['admin']);
    expect(context.guardianNames).toEqual(['Anika Rao']);
  });

  it('degrades gracefully when family links or teachers are missing', async () => {
    const context = await resolveActivityRenderContext({
      supabase: makeSupabase({
        participants: [{ profile_id: student.id }],
        profiles: [student, guardian],
        familyLinks: [],
      }),
      event: makeEvent(),
      recipientProfile: guardian,
    });

    expect(context.teacherNames).toEqual([]);
    expect(context.guardianNames).toEqual([]);
    expect(context.viewerStudentNames).toEqual([]);
  });
});
