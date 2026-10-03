import { describe, expect, it, vi } from 'vitest';

vi.mock('@iconicedu/live-sessions-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@iconicedu/live-sessions-core')>();
  return {
    ...actual,
    getLiveSessionProvider: vi.fn(() => ({
      createSession: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
        providerSessionId: `provider-${sessionId}`,
        providerMetadata: {},
      })),
      getJoinAccess: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
        joinUrl: `https://meet.example.com/${sessionId}`,
        token: 'join-token',
        metadata: {},
      })),
    })),
  };
});

import { getLiveSessionProvider } from '@iconicedu/live-sessions-core';
import { resolveLiveSessionJoinAccess } from '@iconicedu/web/lib/live-sessions/service';

function createServiceSupabaseStub(input?: {
  activeLiveSessionRow?: Record<string, unknown> | null;
  memberProfileIds?: string[];
  familyLinks?: Array<{
    guardianAccountId: string;
    childAccountId: string;
  }>;
  childProfiles?: Array<{
    id: string;
    accountId: string;
    kind?: string;
  }>;
}) {
  const liveSessionRow: Record<string, unknown> | null =
    input?.activeLiveSessionRow ?? null;
  const memberProfileIds = new Set(input?.memberProfileIds ?? ['profile-1']);
  const familyLinks = input?.familyLinks ?? [];
  const childProfiles = input?.childProfiles ?? [];
  const availableProfiles = [
    { id: 'profile-1', accountId: 'account-1', kind: 'educator' },
    ...childProfiles,
  ];

  return {
    from(table: string) {
      if (table === 'channel_members') {
        const filters: { profileIds?: string[] } = {};
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'profile_id') {
              filters.profileIds = [value];
            }
            return this;
          },
          in(column: string, values: string[]) {
            if (column === 'profile_id') {
              filters.profileIds = values;
            }
            return this;
          },
          returns: async () => {
            const scopedIds = filters.profileIds ?? Array.from(memberProfileIds);
            const matches = scopedIds.filter((profileId) =>
              memberProfileIds.has(profileId),
            );
            return {
              data: matches.map((profileId, index) => ({
                id: `member-${index + 1}`,
                profile_id: profileId,
              })),
              error: null,
            };
          },
          is() {
            return this;
          },
          limit() {
            return this;
          },
        };
      }

      if (table === 'family_links') {
        const filters: { guardianAccountId?: string } = {};
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'guardian_account_id') {
              filters.guardianAccountId = value;
            }
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({
            data: familyLinks
              .filter((row) => row.guardianAccountId === filters.guardianAccountId)
              .map((row) => ({ child_account_id: row.childAccountId })),
            error: null,
          }),
        };
      }

      if (table === 'profiles') {
        const filters: { accountIds?: string[]; profileIds?: string[]; kind?: string } =
          {};
        return {
          select() {
            return this;
          },
          in(column: string, values: string[]) {
            if (column === 'account_id') {
              filters.accountIds = values;
            }
            if (column === 'id') {
              filters.profileIds = values;
            }
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'kind') {
              filters.kind = value;
            }
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({
            data: availableProfiles
              .filter(
                (profile) =>
                  !filters.accountIds || filters.accountIds.includes(profile.accountId),
              )
              .filter(
                (profile) =>
                  !filters.profileIds || filters.profileIds.includes(profile.id),
              )
              .filter((profile) => !filters.kind || profile.kind === filters.kind)
              .map((profile) => ({ id: profile.id })),
            error: null,
          }),
        };
      }

      if (table === 'channel_live_sessions') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          maybeSingle: async () => ({ data: liveSessionRow, error: null }),
        };
      }

      throw new Error(`Unhandled table stub: ${table}`);
    },
  };
}

describe('resolveLiveSessionJoinAccess', () => {
  it('allows guardians to access a live session when a linked child is a channel member', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-child-1'],
      familyLinks: [
        { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
      ],
      childProfiles: [
        { id: 'profile-child-1', accountId: 'account-child-1', kind: 'child' },
      ],
    });

    const result = await resolveLiveSessionJoinAccess({
      serviceSupabase: serviceSupabase as never,
      liveSessionId: 'live-session-1',
      profile: {
        id: 'profile-guardian-1',
        org_id: 'org-1',
        account_id: 'account-guardian-1',
        kind: 'guardian',
        display_name: 'Riley Guardian',
        first_name: 'Riley',
        last_name: 'Guardian',
      } as never,
    });

    expect(result.session.id).toBe('live-session-1');
    expect(result.joinAccess.joinUrl).toContain('live-session-1');
  });

  it('keeps direct-membership checks for non-guardians', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-member-1'],
    });

    await expect(
      resolveLiveSessionJoinAccess({
        serviceSupabase: serviceSupabase as never,
        liveSessionId: 'live-session-1',
        profile: {
          id: 'profile-educator-1',
          org_id: 'org-1',
          account_id: 'account-educator-1',
          kind: 'educator',
          display_name: 'Jamie Educator',
          first_name: 'Jamie',
          last_name: 'Educator',
        } as never,
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('hosts the educator regardless of who started the session', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        // A student happened to call join()/start the session first — that
        // must no longer make them the host (see resolveLiveSessionJoinAccess).
        started_by_profile_id: 'profile-student-1',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-educator-1'],
    });
    const callIndexBefore = vi.mocked(getLiveSessionProvider).mock.calls.length;

    await resolveLiveSessionJoinAccess({
      serviceSupabase: serviceSupabase as never,
      liveSessionId: 'live-session-1',
      profile: {
        id: 'profile-educator-1',
        org_id: 'org-1',
        account_id: 'account-educator-1',
        kind: 'educator',
        display_name: 'Jamie Educator',
        first_name: 'Jamie',
        last_name: 'Educator',
      } as never,
    });

    const providerInstance = vi.mocked(getLiveSessionProvider).mock.results[
      callIndexBefore
    ].value as { getJoinAccess: ReturnType<typeof vi.fn> };
    expect(providerInstance.getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ isHost: true }),
    );
  });

  it('does not host a plain channel member who happened to start the session', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        started_by_profile_id: 'profile-child-1',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-child-1'],
      childProfiles: [
        { id: 'profile-child-1', accountId: 'account-child-1', kind: 'child' },
      ],
    });
    const callIndexBefore = vi.mocked(getLiveSessionProvider).mock.calls.length;

    await resolveLiveSessionJoinAccess({
      serviceSupabase: serviceSupabase as never,
      liveSessionId: 'live-session-1',
      profile: {
        id: 'profile-child-1',
        org_id: 'org-1',
        account_id: 'account-child-1',
        kind: 'child',
        display_name: 'Riley Child',
        first_name: 'Riley',
        last_name: 'Child',
      } as never,
    });

    const providerInstance = vi.mocked(getLiveSessionProvider).mock.results[
      callIndexBefore
    ].value as { getJoinAccess: ReturnType<typeof vi.fn> };
    expect(providerInstance.getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ isHost: false }),
    );
  });
});
