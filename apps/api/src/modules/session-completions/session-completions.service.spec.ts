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
      limit: jest.fn(() => chain),
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

  function makeSupabase(input: {
    completionRow: Record<string, unknown> | null;
    accountRow?: Record<string, unknown> | null;
    profileRow?: Record<string, unknown> | null;
    familyLinkRow?: Record<string, unknown> | null;
    updatedRow?: { id: string } | null;
    rpcRows?: Array<Record<string, unknown>>;
  }) {
    const accountChain = makeChain({
      data: input.accountRow ?? { id: ACCOUNT_ID, org_id: ORG_ID },
    });
    const completionChain = makeChain({ data: input.completionRow });
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

    const from = jest.fn((table: string) => {
      if (table === 'accounts') return accountChain;
      if (table === 'class_session_completions') {
        return { select: jest.fn(() => completionChain), update: updateChain.update };
      }
      if (table === 'profiles') return profileChain;
      if (table === 'family_links') return familyLinkChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const rpc = jest.fn(async () => ({ data: input.rpcRows ?? [], error: null }));
    createSupabaseServiceClientMock.mockReturnValue({ from, rpc } as never);
    return { from, updateChain, rpc };
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

  describe('confirm', () => {
    it('confirms a pending row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'pending' }) });
      const service = new SessionCompletionsService();

      const result = await service.confirm(AUTH_USER_ID, {
        orgId: ORG_ID,
        sessionCompletionId: COMPLETION_ID,
      });

      expect(result).toEqual({ success: true, feedbackEnabled: true });
    });

    it('rejects confirming an already-disputed row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'disputed' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.confirm(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a stale confirm when another request resolves the row first', async () => {
      makeSupabase({
        completionRow: baseCompletionRow({ status: 'pending' }),
        updatedRow: null,
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

    it('rejects disputing an already-confirmed row', async () => {
      makeSupabase({ completionRow: baseCompletionRow({ status: 'confirmed' }) });
      const service = new SessionCompletionsService();

      await expect(
        service.dispute(AUTH_USER_ID, {
          orgId: ORG_ID,
          sessionCompletionId: COMPLETION_ID,
          disputeCategory: 'technical_issue',
        }),
      ).rejects.toThrow(BadRequestException);
    });

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
