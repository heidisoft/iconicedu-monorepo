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
        data: [{ schedule_id: SCHEDULE_ID, display_name: 'Jamie Lee' }],
      });
      const from = jest.fn((table: string) => {
        if (table === 'accounts') return accountChain;
        if (table === 'user_roles') return roleChain;
        if (table === 'class_session_completions') return completionChain;
        if (table === 'profiles') return profilesChain;
        if (table === 'class_schedule_participants') return participantsChain;
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
        averageRating: 5,
        confirmedBy: [
          { displayName: 'Taylor Reed', role: 'educator' },
          { displayName: 'Morgan Lee', role: 'guardian' },
        ],
      });
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
        '2026-10-01T00:00:00.000Z',
      );
    });

    it('omits the window bounds when no range is given', async () => {
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

      expect(completionChain.gte).not.toHaveBeenCalled();
      expect(completionChain.lt).not.toHaveBeenCalled();
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
      completionRows?: Array<{
        schedule_id: string;
        occurrence_key: string;
        status: string;
        session_end_at?: string;
      }>;
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
      const completionsChain = makeChain({ data: input.completionRows ?? [] });

      let accountCalls = 0;
      const from = jest.fn((table: string) => {
        if (table === 'accounts') {
          accountCalls += 1;
          // 1st: resolveAccount. 2nd: assertAdminAccess primary_role check.
          return accountCalls === 1 ? accountChain : primaryRoleChain;
        }
        if (table === 'user_roles') return roleChain;
        if (table === 'class_session_completions') return completionsChain;
        throw new Error(`Unexpected table: ${table}`);
      });

      createSupabaseServiceClientMock.mockReturnValue({ from } as never);
      return { from, completionsChain };
    }

    it('collapses cross-party rows to occurrences and nets pending against completed', async () => {
      const { completionsChain } = makeOrgSummarySupabase({
        completionRows: [
          // Occurrence A: both parties confirmed -> counts once as completed.
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-06T10:00:00.000Z',
            status: 'confirmed',
            session_end_at: '2030-03-06T11:00:00.000Z',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-06T10:00:00.000Z',
            status: 'auto_confirmed',
            session_end_at: '2030-03-06T11:00:00.000Z',
          },
          // Occurrence B: one party confirmed, the other still pending -> completed, not pending.
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-13T10:00:00.000Z',
            status: 'confirmed',
            session_end_at: '2030-03-13T11:00:00.000Z',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-13T10:00:00.000Z',
            status: 'pending',
            session_end_at: '2030-03-13T11:00:00.000Z',
          },
          // Occurrence C: only pending rows -> pending.
          {
            schedule_id: '00000000-0000-4000-8000-0000000000aa',
            occurrence_key: '2030-03-20T10:00:00.000Z',
            status: 'pending',
            session_end_at: '2030-03-20T11:00:00.000Z',
          },
        ],
      });
      const service = new SessionCompletionsService();

      const result = await service.getOrgCompletionSummary(AUTH_USER_ID, {
        orgId: ORG_ID,
      });

      expect(completionsChain.in).toHaveBeenCalledWith('status', [
        'confirmed',
        'auto_confirmed',
        'pending',
      ]);
      expect(result).toEqual({ completed: 2, pending: 1 });
    });

    it('bounds completed to the session_end_at window but leaves pending unbounded', async () => {
      makeOrgSummarySupabase({
        completionRows: [
          // In-window confirmed occurrence.
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-03-10T10:00:00.000Z',
            status: 'confirmed',
            session_end_at: '2030-03-10T11:00:00.000Z',
          },
          // Confirmed but ended before the window -> not completed this month,
          // and still excluded from pending because it is resolved.
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-02-25T10:00:00.000Z',
            status: 'confirmed',
            session_end_at: '2030-02-25T11:00:00.000Z',
          },
          {
            schedule_id: SCHEDULE_ID,
            occurrence_key: '2030-02-25T10:00:00.000Z',
            status: 'pending',
            session_end_at: '2030-02-25T11:00:00.000Z',
          },
          // Genuinely unresolved occurrence, regardless of month.
          {
            schedule_id: '00000000-0000-4000-8000-0000000000bb',
            occurrence_key: '2030-01-05T10:00:00.000Z',
            status: 'pending',
            session_end_at: '2030-01-05T11:00:00.000Z',
          },
        ],
      });
      const service = new SessionCompletionsService();

      const result = await service.getOrgCompletionSummary(AUTH_USER_ID, {
        orgId: ORG_ID,
        completedSince: '2030-03-01T00:00:00.000Z',
        completedUntil: '2030-04-01T00:00:00.000Z',
      });

      expect(result).toEqual({ completed: 1, pending: 1 });
    });

    it('rejects a non-admin caller', async () => {
      makeOrgSummarySupabase({ roleRow: null, primaryRoleRow: null });
      const service = new SessionCompletionsService();

      await expect(
        service.getOrgCompletionSummary(AUTH_USER_ID, { orgId: ORG_ID }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an invalid orgId before querying', async () => {
      const { from } = makeOrgSummarySupabase({});
      const service = new SessionCompletionsService();

      await expect(
        service.getOrgCompletionSummary(AUTH_USER_ID, { orgId: 'not-a-uuid' }),
      ).rejects.toThrow(BadRequestException);
      expect(from).not.toHaveBeenCalled();
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
});
