import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SessionCompletionsService } from '@iconicedu/api/modules/session-completions/session-completions.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const AUTH_USER_ID = 'auth-user-1';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000002';
const PROFILE_ID = '00000000-0000-4000-8000-000000000003';
const COMPLETION_ID = '00000000-0000-4000-8000-000000000004';
const OTHER_PROFILE_ID = '00000000-0000-4000-8000-000000000005';
const OTHER_ACCOUNT_ID = '00000000-0000-4000-8000-000000000006';
const SCHEDULE_ID = '00000000-0000-4000-8000-000000000007';
const CHANNEL_ID = '00000000-0000-4000-8000-000000000009';

describe('SessionCompletionsService', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeChain<T>(result: { data: T; error?: null }) {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      is: jest.fn(() => chain),
      gte: jest.fn(() => chain),
      range: jest.fn(() => chain),
      lt: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      order: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => result),
      returns: jest.fn(async () => result),
    };
    return chain;
  }

  function makeUpdateChain(updated: { id: string } | null = { id: COMPLETION_ID }) {
    const chain: Record<string, jest.Mock> = {
      update: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      is: jest.fn(() => chain),
      select: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: updated, error: null })),
    };
    return chain;
  }

  // No `.select()/.maybeSingle()` on this one — markRelatedActivityFeedItemsRead
  // awaits the update chain directly (matching the real Supabase query shape).
  function makeMarkReadUpdateChain() {
    const chain: Record<string, jest.Mock> = {
      update: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
    };
    return chain;
  }

  function makeSupabase(input: {
    completionRow: Record<string, unknown> | null;
    accountRow?: Record<string, unknown> | null;
    profileRow?: Record<string, unknown> | null;
    familyLinkRow?: Record<string, unknown> | null;
    updatedRow?: { id: string } | null;
    // When set, the SECOND `class_session_completions` select (confirm's
    // post-lost-race re-read) resolves to this instead of `completionRow`.
    rereadRow?: Record<string, unknown> | null;
    rpcRows?: Array<Record<string, unknown>>;
    activityFeedItems?: Array<{ id: string; metadata: unknown }>;
  }) {
    const accountChain = makeChain({
      data: input.accountRow ?? { id: ACCOUNT_ID, org_id: ORG_ID },
    });
    const completionChain = makeChain({ data: input.completionRow });
    const completionRereadChain = makeChain({
      data: input.rereadRow === undefined ? input.completionRow : input.rereadRow,
    });
    const profileChain = makeChain({
      data: input.profileRow ?? {
        id: PROFILE_ID,
        account_id: ACCOUNT_ID,
        org_id: ORG_ID,
        kind: 'child',
      },
    });
    const familyLinkChain = makeChain({ data: input.familyLinkRow ?? null });
    const updateChain = makeUpdateChain(
      input.updatedRow === undefined ? { id: COMPLETION_ID } : input.updatedRow,
    );
    const activityFeedItemsSelectChain = makeChain({
      data: input.activityFeedItems ?? [],
    });
    const activityFeedItemsUpdateChain = makeMarkReadUpdateChain();

    let completionSelectCalls = 0;
    const from = jest.fn((table: string) => {
      if (table === 'accounts') return accountChain;
      if (table === 'class_session_completions') {
        return {
          select: jest.fn(() => {
            completionSelectCalls += 1;
            // 1st select: loadOwnedRow. 2nd: confirm's lost-race re-read.
            return completionSelectCalls === 1 ? completionChain : completionRereadChain;
          }),
          update: updateChain.update,
        };
      }
      if (table === 'profiles') return profileChain;
      if (table === 'family_links') return familyLinkChain;
      if (table === 'activity_feed_items') {
        return {
          select: jest.fn(() => activityFeedItemsSelectChain),
          update: activityFeedItemsUpdateChain.update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const rpc = jest.fn(async () => ({ data: input.rpcRows ?? [], error: null }));
    createSupabaseServiceClientMock.mockReturnValue({ from, rpc } as never);
    return { from, updateChain, activityFeedItemsUpdateChain, rpc };
  }

  function baseCompletionRow(overrides: Record<string, unknown> = {}) {
    return {
      id: COMPLETION_ID,
      org_id: ORG_ID,
      schedule_id: SCHEDULE_ID,
      occurrence_key: '2030-03-06T10:00:00.000Z',
      profile_id: PROFILE_ID,
      role: 'child',
      status: 'pending',
      dispute_category: null,
      dispute_reason: null,
      reschedule_requested: false,
      rating: null,
      rating_comment: null,
      channel_id: 'channel-1',
      learning_space_id: 'space-1',
      session_title: 'Math',
      session_end_at: '2030-03-06T11:00:00.000Z',
      resolved_at: null,
      expires_at: '2030-03-09T11:00:00.000Z',
      ...overrides,
    };
  }

  describe('listForAdmin', () => {
    beforeEach(() =>
      jest.useFakeTimers().setSystemTime(new Date('2026-09-07T12:00:00.000Z')),
    );
    afterEach(() => jest.useRealTimers());
    it('groups participant confirmations into one completed occurrence', async () => {
      const accountChain = makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
      const roleChain = makeChain({ data: { role_key: 'admin' } });
      const completionChain = makeChain({
        data: [
          baseCompletionRow({
            profile_id: PROFILE_ID,
            role: 'educator',
            status: 'confirmed',
            rating: 5,
            student_name: 'Jamie Lee',
            resolved_at: '2030-03-06T11:05:00.000Z',
            updated_at: '2030-03-06T11:05:00.000Z',
          }),
          baseCompletionRow({
            id: '00000000-0000-4000-8000-000000000008',
            profile_id: OTHER_PROFILE_ID,
            role: 'guardian',
            status: 'auto_confirmed',
            student_name: 'Jamie Lee',
            resolved_at: '2030-03-06T11:03:00.000Z',
            updated_at: '2030-03-06T11:03:00.000Z',
          }),
        ],
      });
      const profilesChain = makeChain({
        data: [
          {
            id: PROFILE_ID,
            display_name: 'Taylor Reed',
            first_name: null,
            last_name: null,
          },
          {
            id: OTHER_PROFILE_ID,
            display_name: 'Morgan Lee',
            first_name: null,
            last_name: null,
          },
        ],
      });
      const participantsChain = makeChain({
        data: [
          {
            schedule_id: SCHEDULE_ID,
            profile_id: PROFILE_ID,
            role: 'child',
            display_name: 'Jamie Lee',
          },
          {
            schedule_id: SCHEDULE_ID,
            profile_id: OTHER_PROFILE_ID,
            role: 'guardian',
            display_name: 'Morgan Lee',
          },
        ],
      });
      const learningSpacesChain = makeChain({
        data: [{ id: 'space-1', title: 'Room A' }],
      });
      const from = jest.fn((table: string) => {
        if (table === 'accounts') return accountChain;
        if (table === 'user_roles') return roleChain;
        if (table === 'class_session_completions') return completionChain;
        if (table === 'profiles') return profilesChain;
        if (table === 'class_schedule_participants') return participantsChain;
        if (table === 'learning_spaces') return learningSpacesChain;
        throw new Error(`Unexpected table: ${table}`);
      });
      createSupabaseServiceClientMock.mockReturnValue({ from } as never);

      const result = await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        completionMethod: 'mixed',
        studentNames: ['Jamie Lee'],
        learningSpaceTitle: 'Room A',
        averageRating: 5,
        confirmedBy: [
          { displayName: 'Taylor Reed', role: 'educator' },
          { displayName: 'Morgan Lee', role: 'guardian' },
        ],
        guardians: [{ profileId: OTHER_PROFILE_ID, displayName: 'Morgan Lee' }],
      });
    });

    it('resolves guardians through family_links when they are not schedule participants', async () => {
      const GUARDIAN_PROFILE_ID = '00000000-0000-4000-8000-0000000000a1';
      const GUARDIAN_ACCOUNT_ID = '00000000-0000-4000-8000-0000000000a2';
      const CHILD_ACCOUNT_ID = '00000000-0000-4000-8000-0000000000a3';

      const completionChain = makeChain({
        data: [
          baseCompletionRow({
            profile_id: PROFILE_ID,
            role: 'educator',
            status: 'confirmed',
            student_name: 'Jamie Lee',
            resolved_at: '2030-03-06T11:05:00.000Z',
            updated_at: '2030-03-06T11:05:00.000Z',
          }),
        ],
      });
      // Only a child on the roster — no guardian participant row.
      const participantsChain = makeChain({
        data: [
          {
            schedule_id: SCHEDULE_ID,
            profile_id: PROFILE_ID,
            role: 'child',
            display_name: 'Jamie Lee',
          },
        ],
      });
      // `profiles` is queried three times (confirmers, child, guardians); branch
      // on the requested column list.
      const profilesFrom = () => {
        const chain: Record<string, jest.Mock> = {
          eq: jest.fn(() => chain),
          in: jest.fn(() => chain),
          is: jest.fn(() => chain),
          select: jest.fn((columns: string) => {
            if (columns.includes('kind') && !columns.includes('display_name')) {
              chain.returns = jest.fn(async () => ({
                data: [{ id: PROFILE_ID, account_id: CHILD_ACCOUNT_ID, kind: 'child' }],
              }));
            } else if (columns.includes('account_id')) {
              chain.returns = jest.fn(async () => ({
                data: [
                  {
                    id: GUARDIAN_PROFILE_ID,
                    account_id: GUARDIAN_ACCOUNT_ID,
                    display_name: 'Robin Ash',
                    first_name: null,
                    last_name: null,
                  },
                ],
              }));
            } else {
              chain.returns = jest.fn(async () => ({
                data: [
                  {
                    id: PROFILE_ID,
                    display_name: 'Taylor Reed',
                    first_name: null,
                    last_name: null,
                  },
                ],
              }));
            }
            return chain;
          }),
          returns: jest.fn(async () => ({ data: [] })),
        };
        return chain;
      };
      const from = jest.fn((table: string) => {
        if (table === 'accounts')
          return makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
        if (table === 'user_roles') return makeChain({ data: { role_key: 'admin' } });
        if (table === 'class_session_completions') return completionChain;
        if (table === 'class_schedule_participants') return participantsChain;
        if (table === 'learning_spaces')
          return makeChain({ data: [{ id: 'space-1', title: 'Room A' }] });
        if (table === 'profiles') return profilesFrom();
        if (table === 'family_links')
          return makeChain({
            data: [
              {
                guardian_account_id: GUARDIAN_ACCOUNT_ID,
                child_account_id: CHILD_ACCOUNT_ID,
              },
            ],
          });
        throw new Error(`Unexpected table: ${table}`);
      });
      createSupabaseServiceClientMock.mockReturnValue({ from } as never);

      const result = await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.guardians).toEqual([
        { profileId: GUARDIAN_PROFILE_ID, displayName: 'Robin Ash' },
      ]);
    });

    it('bounds the read to the requested session_end_at window', async () => {
      const completionChain = makeChain({ data: [] });
      const from = jest.fn((table: string) => {
        if (table === 'accounts')
          return makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
        if (table === 'user_roles') return makeChain({ data: { role_key: 'admin' } });
        if (table === 'class_session_completions') return completionChain;
        throw new Error(`Unexpected table: ${table}`);
      });
      createSupabaseServiceClientMock.mockReturnValue({ from } as never);

      await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
        completedSince: '2026-09-01T00:00:00.000Z',
        completedUntil: '2026-10-01T00:00:00.000Z',
      });

      expect(completionChain.gte).toHaveBeenCalledWith(
        'session_end_at',
        '2026-09-01T00:00:00.000Z',
      );
      expect(completionChain.lt).toHaveBeenCalledWith(
        'session_end_at',
        '2026-09-07T12:00:00.000Z',
      );
    });

    it('defaults to the rolling three-month window when no range is given', async () => {
      const completionChain = makeChain({ data: [] });
      const from = jest.fn((table: string) => {
        if (table === 'accounts')
          return makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
        if (table === 'user_roles') return makeChain({ data: { role_key: 'admin' } });
        if (table === 'class_session_completions') return completionChain;
        throw new Error(`Unexpected table: ${table}`);
      });
      createSupabaseServiceClientMock.mockReturnValue({ from } as never);

      await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, { orgId: ORG_ID });

      expect(completionChain.gte).toHaveBeenCalledWith(
        'session_end_at',
        '2026-06-07T12:00:00.000Z',
      );
      expect(completionChain.lt).toHaveBeenCalledWith(
        'session_end_at',
        '2026-09-07T12:00:00.000Z',
      );
    });
  });

  describe('admin confirmation reporting', () => {
    beforeEach(() =>
      jest.useFakeTimers().setSystemTime(new Date('2026-05-31T12:00:00.000Z')),
    );
    afterEach(() => jest.useRealTimers());

    function setup(rows: ReturnType<typeof baseCompletionRow>[]) {
      const completions = makeChain({ data: rows });
      const from = jest.fn((table: string) => {
        if (table === 'accounts')
          return makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
        if (table === 'user_roles') return makeChain({ data: { role_key: 'admin' } });
        if (table === 'class_session_completions') return completions;
        if (table === 'profiles') return makeChain({ data: [] });
        if (table === 'learning_spaces') return makeChain({ data: [] });
        if (table === 'class_schedule_participants')
          return makeChain({
            data: [
              {
                schedule_id: SCHEDULE_ID,
                profile_id: PROFILE_ID,
                role: 'educator',
                display_name: 'Tutor One',
              },
              {
                schedule_id: SCHEDULE_ID,
                profile_id: OTHER_PROFILE_ID,
                role: 'guardian',
                display_name: 'Parent One',
              },
              {
                schedule_id: SCHEDULE_ID,
                profile_id: 'other-tutor',
                role: 'educator',
                display_name: 'Tutor Two',
              },
            ],
          });
        throw new Error(`Unexpected table: ${table}`);
      });
      createSupabaseServiceClientMock.mockReturnValue({ from } as never);
      return { completions, from };
    }

    it('retains pending recipients and roster tutors but excludes staff and child confirmations from participants', async () => {
      setup([
        baseCompletionRow({
          role: 'educator',
          status: 'confirmed',
          rating: 5,
          updated_at: '2026-05-30T12:00:00Z',
        }),
        baseCompletionRow({
          profile_id: OTHER_PROFILE_ID,
          role: 'guardian',
          status: 'pending',
        }),
        baseCompletionRow({
          profile_id: 'staff',
          role: 'staff',
          status: 'confirmed',
          updated_at: '2026-05-30T12:00:00Z',
        }),
        baseCompletionRow({
          profile_id: 'child',
          role: 'child',
          status: 'confirmed',
          updated_at: '2026-05-30T12:00:00Z',
        }),
        baseCompletionRow({
          schedule_id: 'unconfirmed-session',
          role: 'educator',
          status: 'pending',
        }),
      ]);
      const rows = await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].participants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            profileId: PROFILE_ID,
            status: 'confirmed',
            rating: 5,
          }),
          expect.objectContaining({
            profileId: OTHER_PROFILE_ID,
            status: 'pending',
            rating: null,
          }),
          expect.objectContaining({ profileId: 'other-tutor', status: 'pending' }),
        ]),
      );
      expect(rows[0].participants).toHaveLength(3);
      expect(rows[0].confirmedBy).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'pending' })]),
      );
    });

    it('clamps month-end subtraction and caller-supplied dates', async () => {
      const { completions } = setup([]);
      await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
        completedSince: '2020-01-01',
        completedUntil: '2030-01-01',
      });
      expect(completions.gte).toHaveBeenCalledWith(
        'session_end_at',
        '2026-02-28T12:00:00.000Z',
      );
      expect(completions.lt).toHaveBeenCalledWith(
        'session_end_at',
        '2026-05-31T12:00:00.000Z',
      );
    });

    it('returns no rows for a month entirely outside the allowed window', async () => {
      const { completions } = setup([]);
      expect(
        await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
          orgId: ORG_ID,
          completedSince: '2020-01-01',
          completedUntil: '2020-02-01',
        }),
      ).toEqual([]);
      expect(completions.select).not.toHaveBeenCalled();
    });

    it.each([
      { completedSince: 'invalid' },
      { completedUntil: 'invalid' },
      { completedSince: '2026-05-01', completedUntil: '2026-04-01' },
    ])('rejects invalid dates: %j', async (range) => {
      setup([]);
      await expect(
        new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
          orgId: ORG_ID,
          ...range,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reads beyond the first database page without splitting occurrence recipients', async () => {
      const confirmed = baseCompletionRow({
        role: 'educator',
        status: 'confirmed',
        updated_at: '2026-05-30T12:00:00Z',
      });
      const { completions } = setup([]);
      completions.returns
        .mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => confirmed) })
        .mockResolvedValueOnce({
          data: [
            baseCompletionRow({
              profile_id: OTHER_PROFILE_ID,
              role: 'guardian',
              status: 'pending',
            }),
          ],
        });
      const rows = await new SessionCompletionsService().listForAdmin(AUTH_USER_ID, {
        orgId: ORG_ID,
      });
      expect(completions.range).toHaveBeenNthCalledWith(2, 500, 999);
      expect(rows).toHaveLength(1);
      expect(rows[0].participants).toContainEqual(
        expect.objectContaining({ profileId: OTHER_PROFILE_ID, status: 'pending' }),
      );
    });
  });

  describe('listForProfile', () => {
    it('returns a bounded cursor page from the consolidated source', async () => {
      const first = { ...baseCompletionRow(), order_key: '2030-03-06T11:00:00.000Z' };
      const second = {
        ...baseCompletionRow({
          id: '00000000-0000-4000-8000-000000000008',
          session_end_at: '2030-03-05T11:00:00.000Z',
        }),
        order_key: '2030-03-05T11:00:00.000Z',
      };
      const { rpc } = makeSupabase({
        completionRow: null,
        rpcRows: [first, second],
      });
      const service = new SessionCompletionsService();

      const result = await service.listForProfile(AUTH_USER_ID, {
        orgId: ORG_ID,
        profileId: PROFILE_ID,
        limit: 1.9,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: COMPLETION_ID,
        scheduleId: SCHEDULE_ID,
        status: 'pending',
      });
      expect(result.nextCursor).toEqual(expect.any(String));
      expect(rpc).toHaveBeenCalledWith('list_class_session_completions_for_profile', {
        p_org_id: ORG_ID,
        p_profile_id: PROFILE_ID,
        p_limit: 2,
        p_cursor_order_key: null,
        p_cursor_id: null,
      });
    });

    it('rejects a cursor with invalid timestamp and identifier values', async () => {
      const { rpc } = makeSupabase({ completionRow: null });
      const service = new SessionCompletionsService();
      const cursor = Buffer.from(
        JSON.stringify({ orderKey: 'not-a-date', id: 'not-a-uuid' }),
        'utf8',
      ).toString('base64url');

      await expect(
        service.listForProfile(AUTH_USER_ID, {
          orgId: ORG_ID,
          profileId: PROFILE_ID,
          cursor,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('getCompletionSummaryForProfile', () => {
    // A chainable, awaitable stand-in for a PostgREST head:count query.
    function makeCountChain(count: number) {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'in', 'gte', 'lt']) {
        chain[method] = jest.fn(() => chain);
      }
      chain.then = (resolve: (value: { count: number; error: null }) => unknown) =>
        Promise.resolve({ count, error: null }).then(resolve);
      return chain;
    }

    function makeSummarySupabase(input: {
      completedCount: number;
      pendingCount: number;
      profileRow?: Record<string, unknown> | null;
      familyLinkRow?: Record<string, unknown> | null;
    }) {
      const accountChain = makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
      const profileChain = makeChain({
        data:
          input.profileRow === undefined
            ? { id: PROFILE_ID, account_id: ACCOUNT_ID, org_id: ORG_ID, kind: 'child' }
            : input.profileRow,
      });
      const familyLinkChain = makeChain({ data: input.familyLinkRow ?? null });

      let completionsSelectCalls = 0;
      const from = jest.fn((table: string) => {
        if (table === 'accounts') return accountChain;
        if (table === 'profiles') return profileChain;
        if (table === 'family_links') return familyLinkChain;
        if (table === 'class_session_completions') {
          return {
            // 1st select() builds the "completed" count query, 2nd the "pending" one.
            select: jest.fn(() => {
              completionsSelectCalls += 1;
              return makeCountChain(
                completionsSelectCalls === 1 ? input.completedCount : input.pendingCount,
              );
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      createSupabaseServiceClientMock.mockReturnValue({ from } as never);
      return { from };
    }

    it('returns exact confirmed and pending counts, not a page slice', async () => {
      makeSummarySupabase({ completedCount: 137, pendingCount: 4 });
      const service = new SessionCompletionsService();

      const result = await service.getCompletionSummaryForProfile(AUTH_USER_ID, {
        orgId: ORG_ID,
        profileId: PROFILE_ID,
        completedSince: '2026-03-01T00:00:00.000Z',
        completedUntil: '2026-04-01T00:00:00.000Z',
      });

      expect(result).toEqual({ completed: 137, pending: 4 });
    });

    it('rejects an invalid profileId before querying', async () => {
      const { from } = makeSummarySupabase({ completedCount: 0, pendingCount: 0 });
      const service = new SessionCompletionsService();

      await expect(
        service.getCompletionSummaryForProfile(AUTH_USER_ID, {
          orgId: ORG_ID,
          profileId: 'not-a-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(from).not.toHaveBeenCalled();
    });

    it('rejects a profile the requesting account may not act for', async () => {
      makeSummarySupabase({
        completedCount: 0,
        pendingCount: 0,
        profileRow: {
          id: OTHER_PROFILE_ID,
          account_id: OTHER_ACCOUNT_ID,
          org_id: ORG_ID,
          kind: 'child',
        },
        familyLinkRow: null,
      });
      const service = new SessionCompletionsService();

      await expect(
        service.getCompletionSummaryForProfile(AUTH_USER_ID, {
          orgId: ORG_ID,
          profileId: OTHER_PROFILE_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOrgCompletionSummary', () => {
    function makeOrgSummarySupabase(input: {
      summaryRows?: Array<{ completed: number; pending: number }>;
      roleRow?: { role_key: string } | null;
      primaryRoleRow?: { id: string } | null;
    }) {
      const accountChain = makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
      const roleChain = makeChain({
        data: input.roleRow === undefined ? { role_key: 'staff' } : input.roleRow,
      });
      const primaryRoleChain = makeChain({
        data: input.primaryRoleRow === undefined ? null : input.primaryRoleRow,
      });

      let accountCalls = 0;
      const from = jest.fn((table: string) => {
        if (table === 'accounts') {
          accountCalls += 1;
          // 1st: resolveAccount. 2nd: assertAdminAccess primary_role check.
          return accountCalls === 1 ? accountChain : primaryRoleChain;
        }
        if (table === 'user_roles') return roleChain;
        throw new Error(`Unexpected table: ${table}`);
      });

      const rpc = jest.fn(async () => ({
        data: input.summaryRows ?? [],
        error: null,
      }));

      createSupabaseServiceClientMock.mockReturnValue({ from, rpc } as never);
      return { from, rpc };
    }

    it('delegates to the org summary function and returns its counts', async () => {
      const { rpc } = makeOrgSummarySupabase({
        summaryRows: [{ completed: 2, pending: 1 }],
      });
      const service = new SessionCompletionsService();

      const result = await service.getOrgCompletionSummary(AUTH_USER_ID, {
        orgId: ORG_ID,
      });

      expect(rpc).toHaveBeenCalledWith('get_org_session_completion_summary', {
        p_org_id: ORG_ID,
        p_since: null,
        p_until: null,
      });
      expect(result).toEqual({ completed: 2, pending: 1 });
    });

    it('passes the completed-window bounds through to the function', async () => {
      const { rpc } = makeOrgSummarySupabase({
        summaryRows: [{ completed: 1, pending: 4 }],
      });
      const service = new SessionCompletionsService();

      const result = await service.getOrgCompletionSummary(AUTH_USER_ID, {
        orgId: ORG_ID,
        completedSince: '2030-03-01T00:00:00.000Z',
        completedUntil: '2030-04-01T00:00:00.000Z',
      });

      expect(rpc).toHaveBeenCalledWith('get_org_session_completion_summary', {
        p_org_id: ORG_ID,
        p_since: '2030-03-01T00:00:00.000Z',
        p_until: '2030-04-01T00:00:00.000Z',
      });
      expect(result).toEqual({ completed: 1, pending: 4 });
    });

    it('defaults to zero counts when the function returns no row', async () => {
      makeOrgSummarySupabase({ summaryRows: [] });
      const service = new SessionCompletionsService();

      const result = await service.getOrgCompletionSummary(AUTH_USER_ID, {
        orgId: ORG_ID,
      });

      expect(result).toEqual({ completed: 0, pending: 0 });
    });

    it('rejects a non-admin caller', async () => {
      makeOrgSummarySupabase({ roleRow: null, primaryRoleRow: null });
      const service = new SessionCompletionsService();

      await expect(
        service.getOrgCompletionSummary(AUTH_USER_ID, { orgId: ORG_ID }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an invalid orgId before querying', async () => {
      const { from, rpc } = makeOrgSummarySupabase({});
      const service = new SessionCompletionsService();

      await expect(
        service.getOrgCompletionSummary(AUTH_USER_ID, { orgId: 'not-a-uuid' }),
      ).rejects.toThrow(BadRequestException);
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('marks the originating notification(s) as read, single and batched alike', async () => {
      const { activityFeedItemsUpdateChain } = makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
        activityFeedItems: [
          { id: 'item-single', metadata: { sessionCompletionId: COMPLETION_ID } },
          {
            id: 'item-batch',
            metadata: { sessions: [{ sessionCompletionId: COMPLETION_ID }] },
          },
          { id: 'item-unrelated', metadata: { sessionCompletionId: 'some-other-id' } },
        ],
      });
      const service = new SessionCompletionsService();

      await service.confirm(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(activityFeedItemsUpdateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true, read_at: expect.any(String) }),
      );
      expect(activityFeedItemsUpdateChain.in).toHaveBeenCalledWith('id', [
        'item-single',
        'item-batch',
      ]);
    });

    it('does not fail the confirm itself if marking notifications read errors', async () => {
      const { from } = makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
      });
      const originalFrom = from.getMockImplementation()!;
      const erroringSelectChain: Record<string, jest.Mock> = {
        eq: jest.fn(() => erroringSelectChain),
        is: jest.fn(() => erroringSelectChain),
        in: jest.fn(() => erroringSelectChain),
        returns: jest.fn(async () => ({ data: null, error: { message: 'boom' } })),
      };
      from.mockImplementation((table: string) => {
        if (table === 'activity_feed_items') {
          return { select: jest.fn(() => erroringSelectChain) };
        }
        return originalFrom(table);
      });
      const service = new SessionCompletionsService();

      const result = await service.confirm(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true, feedbackEnabled: true });
    });

    it('confirms a pending row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'pending' }) });
      const service = new SessionCompletionsService();

      const result = await service.confirm(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true, feedbackEnabled: true });
    });

    it.each(['confirmed', 'auto_confirmed'] as const)(
      'treats confirming an already-%s row as an idempotent success',
      async (status) => {
        makeSupabase({ completionRow: baseCompletionRow({ status }) });
        const service = new SessionCompletionsService();

        const result = await service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        });

        expect(result).toEqual({
          success: true,
          alreadyResolved: true,
          status,
          feedbackEnabled: true,
        });
      },
    );

    it('rejects confirming an already-disputed row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'disputed' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it.each(['confirmed', 'auto_confirmed'] as const)(
      'treats a lost confirm race as an idempotent success when the winner %s',
      async (status) => {
        makeSupabase({
          completionRow: baseCompletionRow({ status: 'pending' }),
          updatedRow: null,
          rereadRow: baseCompletionRow({ status }),
        });
        const service = new SessionCompletionsService();

        const result = await service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        });

        expect(result).toEqual({
          success: true,
          alreadyResolved: true,
          status,
          feedbackEnabled: true,
        });
      },
    );

    it('rejects a lost confirm race when the winner disputed', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
        updatedRow: null,
        rereadRow: baseCompletionRow({ status: 'disputed' }),
      });
      const service = new SessionCompletionsService();

      await expect(
        service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('reports a plain conflict when a lost confirm race re-reads as still pending', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
        updatedRow: null,
        rereadRow: baseCompletionRow({ status: 'pending' }),
      });
      const service = new SessionCompletionsService();

      await expect(
        service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when the requesting account does not own the profile and has no family link', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({
          status: 'pending',
          profile_id: OTHER_PROFILE_ID,
        }),
        profileRow: {
          id: OTHER_PROFILE_ID,
          account_id: OTHER_ACCOUNT_ID,
          org_id: ORG_ID,
          kind: 'child',
        },
        familyLinkRow: null,
      });
      const service = new SessionCompletionsService();

      await expect(
        service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('dispute', () => {
    it('rejects an invalid disputeCategory', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'pending' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.dispute(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
          disputeCategory: 'not_a_real_category' as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['confirmed', 'auto_confirmed', 'disputed'] as const)(
      'rejects disputing an already-%s row with a Conflict',
      async (status) => {
        makeSupabase({ completionRow: baseCompletionRow({ status }) });
        const service = new SessionCompletionsService();

        await expect(
          service.dispute(AUTH_USER_ID, {
            orgId: ORG_ID,
            sessionCompletionId: COMPLETION_ID,
            disputeCategory: 'technical_issue',
          }),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('publishes a dispute-reported notification to staff on success', async () => {
      const { from } = makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
      });
      // publishDisputeNotifications reads profiles/class_schedule_participants — extend
      // the mock to answer those too.
      let profilesCallCount = 0;
      from.mockImplementation((table: string) => {
        if (table === 'accounts')
          return {
            select: jest.fn(() =>
              makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } }),
            ),
          };
        if (table === 'class_session_completions') {
          return {
            select: jest.fn(() =>
              makeChain({ data: baseCompletionRow({ status: 'pending' }) }),
            ),
            update: jest.fn(() => makeUpdateChain().update()),
          };
        }
        if (table === 'profiles') {
          profilesCallCount += 1;
          // Call 1: resolvePermittedProfile's targetProfile fetch (.maybeSingle()).
          // Call 2: reporterProfile fetch (.maybeSingle()).
          // Call 3: staffProfiles fetch (.returns(), expects an array).
          if (profilesCallCount <= 2) {
            return makeChain({
              data: {
                id: PROFILE_ID,
                account_id: ACCOUNT_ID,
                org_id: ORG_ID,
                kind: 'child',
                display_name: 'Alex Student',
              },
            });
          }
          return makeChain({ data: [{ id: 'staff-1' }] });
        }
        if (table === 'class_schedule_participants') return makeChain({ data: [] });
        throw new Error(`Unexpected table: ${table}`);
      });
      const service = new SessionCompletionsService();

      await service.dispute(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
        disputeCategory: 'teacher_absent',
        disputeReason: 'No one joined',
      });

      expect(publishActivityEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'session.completion.dispute_reported' }),
      );
    });
  });

  describe('listChannelCompletionStates', () => {
    function makeChannelSupabase(input: {
      profileRows?: Array<{ id: string }> | null;
      membershipRow?: { id: string } | null;
      completionRows?: Array<{
        schedule_id: string;
        occurrence_key: string;
        status: string;
      }>;
    }) {
      const accountChain = makeChain({ data: { id: ACCOUNT_ID, org_id: ORG_ID } });
      const profilesChain = makeChain({
        data: input.profileRows === undefined ? [{ id: PROFILE_ID }] : input.profileRows,
      });
      const membershipChain = makeChain({
        data:
          input.membershipRow === undefined ? { id: 'member-1' } : input.membershipRow,
      });
      const completionsChain = makeChain({ data: input.completionRows ?? [] });

      const from = jest.fn((table: string) => {
        if (table === 'accounts') return accountChain;
        if (table === 'profiles') return profilesChain;
        if (table === 'channel_members') return membershipChain;
        if (table === 'class_session_completions') return completionsChain;
        throw new Error(`Unexpected table: ${table}`);
      });

      createSupabaseServiceClientMock.mockReturnValue({ from } as never);
      return { from, completionsChain, membershipChain };
    }

    it('splits confirmed and disputed occurrences and de-duplicates each', async () => {
      const { completionsChain } = makeChannelSupabase({
        completionRows: [
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-06T10:00:00+00:00',
            status: 'confirmed',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-06T10:00:00+00:00',
            status: 'auto_confirmed',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-13T10:00:00+00:00',
            status: 'disputed',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-13T10:00:00+00:00',
            status: 'disputed',
          },
        ],
      });
      const service = new SessionCompletionsService();

      const result = await service.listChannelCompletionStates(AUTH_USER_ID, {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
      });

      expect(completionsChain.in).toHaveBeenCalledWith('status', [
        'confirmed',
        'auto_confirmed',
        'disputed',
      ]);
      expect(result.completions).toEqual([
        { scheduleId: SCHEDULE_ID, occurrenceKey: '2030-03-06T10:00:00+00:00' },
      ]);
      expect(result.disputed).toEqual([
        { scheduleId: SCHEDULE_ID, occurrenceKey: '2030-03-13T10:00:00+00:00' },
      ]);
    });

    it('rejects a caller who is not a member of the channel', async () => {
      makeChannelSupabase({ membershipRow: null });
      const service = new SessionCompletionsService();

      await expect(
        service.listChannelCompletionStates(AUTH_USER_ID, {
          orgId: ORG_ID,
          channelId: CHANNEL_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an invalid channelId before touching the database', async () => {
      const { from } = makeChannelSupabase({});
      const service = new SessionCompletionsService();

      await expect(
        service.listChannelCompletionStates(AUTH_USER_ID, {
          orgId: ORG_ID,
          channelId: 'not-a-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('rate', () => {
    it('rejects rating a still-pending row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'pending' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.rate(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an out-of-range rating', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'confirmed' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.rate(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
          rating: 6,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts rating a confirmed row', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({
          status: 'confirmed',
          learning_space_id: null,
        }),
      });
      const service = new SessionCompletionsService();

      const result = await service.rate(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
        rating: 5,
        comment: 'Great session',
      });

      expect(result).toEqual({ success: true });
    });

    it('accepts rating an auto_confirmed row', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({
          status: 'auto_confirmed',
          learning_space_id: null,
        }),
      });
      const service = new SessionCompletionsService();

      const result = await service.rate(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
        rating: 4,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('skipRating', () => {
    it('rejects skipping a still-pending row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'pending' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.skipRating(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stamps rated_at with no rating on a confirmed row', async () => {
      const { updateChain } = makeSupabase({
        completionRow: baseCompletionRow({
          status: 'confirmed',
          rating: null,
          rated_at: null,
          learning_space_id: null,
        }),
      });
      const service = new SessionCompletionsService();

      const result = await service.skipRating(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true });
      const patch = updateChain.update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.rated_at).toEqual(expect.any(String));
      expect(patch).not.toHaveProperty('rating');
    });

    it('is a no-op success when the row was already rated', async () => {
      const { updateChain } = makeSupabase({
        completionRow: baseCompletionRow({
          status: 'confirmed',
          rating: 5,
          rated_at: '2030-03-06T12:00:00.000Z',
        }),
      });
      const service = new SessionCompletionsService();

      const result = await service.skipRating(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true, alreadyResolved: true });
      expect(updateChain.update).not.toHaveBeenCalled();
    });

    it('is a no-op success when a rating landed first (lost race)', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({
          status: 'confirmed',
          rating: null,
          rated_at: null,
          learning_space_id: null,
        }),
        updatedRow: null,
      });
      const service = new SessionCompletionsService();

      const result = await service.skipRating(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true, alreadyResolved: true });
    });
  });
});
