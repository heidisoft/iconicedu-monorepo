import { requireMeetingAdmission } from './meeting-admissions';
jest.mock('./meeting-admissions', () => ({
  requireMeetingAdmission: jest.fn(async () => undefined),
  meetingAdmissionStatus: jest.fn(),
}));
import { resolveMeetingLink } from './meeting-browser-links';
jest.mock('./meeting-browser-links', () => ({
  issueMeetingLink: jest.fn(async () => 'synthetic-invitation-token'),
  resolveMeetingLink: jest.fn(),
  redeemMeetingHandoff: jest.fn(),
}));
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  evaluateApiBooleanFlag: jest.fn(),
}));
import { issueWhiteboardAccess } from '../whiteboards/whiteboard-access';
jest.mock('../whiteboards/whiteboard-access', () => ({
  issueWhiteboardAccess: jest.fn(async (_session, role) => ({
    provider: 'excalidraw',
    token: 'synthetic-board-token',
    role,
  })),
}));
import { issueAnnotationAccess } from '../screen-annotations/annotation-access';
jest.mock('../screen-annotations/annotation-access', () => ({
  issueAnnotationAccess: jest.fn(async () => 'synthetic-annotation-token'),
}));
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  getLiveSessionProvider,
  hasOrgStaffRole,
  verifyZoomPasscode,
} from '@iconicedu/live-sessions-core';
import { LiveSessionsService } from './live-sessions.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/live-sessions-core', () => ({
  getWebAppUrl: () => 'https://app.invalid',
  getLiveSessionProvider: jest.fn(),
  hasOrgStaffRole: jest.fn(async () => false),
  verifyZoomPasscode: jest.fn(),
}));

describe('public live session identity and authorization', () => {
  const getJoinAccess = jest.fn();
  let authUserId: string | null;
  let hasOrgProfile: boolean;
  let status: string;
  let invitesEnabled: boolean;
  let restricted: boolean;
  let isClassMember: boolean;
  let isTeacher: boolean;
  let isOrgStaff: boolean;
  let guardian: boolean;
  let selections: string[];
  let enrolledStudents: string[];
  let lookupFilters: Array<{ table: string; filters: Record<string, unknown> }>;
  let sessionMetadata: Record<string, unknown>;
  let providerSessionId: string | null;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(hasOrgStaffRole).mockResolvedValue(false);
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    authUserId = 'member-auth';
    sessionMetadata = { sessionName: 'test-class', passcode: 'demo' };
    providerSessionId = 'test-class';
    hasOrgProfile = true;
    status = 'live';
    invitesEnabled = true;
    restricted = false;
    isClassMember = true;
    isTeacher = false;
    isOrgStaff = false;
    guardian = false;
    selections = [];
    enrolledStudents = ['child-one', 'child-two'];
    lookupFilters = [];
    jest.mocked(createSupabaseSessionClient).mockReturnValue({
      auth: {
        getUser: async () => ({
          data: {
            user: authUserId
              ? { id: authUserId, user_metadata: { full_name: 'Signed-in Visitor' } }
              : null,
          },
        }),
      },
    } as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      rpc: jest.fn(async (_name, args) => ({
        data:
          args.p_user === 'host-auth' ||
          (hasOrgProfile && ((isTeacher && isClassMember) || isOrgStaff)),
        error: null,
      })),
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const query = {
          select: jest.fn((selection: string) => {
            selections.push(selection);
            return query;
          }),
          in: jest.fn((key, value) => {
            filters[key] = value;
            return query;
          }),
          then: (resolve: (value: unknown) => unknown) => {
            lookupFilters.push({ table, filters: { ...filters } });
            const data =
              table === 'family_links'
                ? [
                    { child_account_id: 'child-account-one' },
                    { child_account_id: 'child-account-two' },
                  ]
                : table === 'profiles'
                  ? [
                      { id: 'child-one', display_name: 'Alice' },
                      { id: 'child-two', display_name: 'Ben' },
                    ]
                  : enrolledStudents.map((profile_id) => ({ profile_id }));
            return Promise.resolve({ data, error: null }).then(resolve);
          },
          is: jest.fn().mockReturnThis(),
          eq: jest.fn((key, value) => {
            filters[key] = value;
            return query;
          }),
          maybeSingle: async () => {
            lookupFilters.push({ table, filters: { ...filters } });
            let data: unknown = null;
            if (table === 'channel_live_sessions')
              data = {
                id: 'session-identity',
                share_code: 'a3f8b2d4c9e1',
                org_id: 'session-org',
                channel_id: 'class',
                provider: 'zoom',
                status,
                started_by_profile_id: 'host-profile',
                provider_session_id: providerSessionId,
                provider_metadata: sessionMetadata,
                ...(!invitesEnabled || restricted
                  ? {
                      app_metadata: {
                        meetingSettings: {
                          ...DEFAULT_LIVE_SESSION_SETTINGS,
                          invite: { enabled: invitesEnabled },
                          access: { mode: restricted ? 'restricted' : 'open' },
                        },
                      },
                    }
                  : {}),
              };
            if (table === 'channel_members' && isClassMember) data = { id: 'membership' };
            if (table === 'channels') data = { topic: 'Science' };
            if (table === 'profiles') {
              if (filters.id === 'host-profile' || filters.account_id === 'host-account')
                data = {
                  id: 'host-profile',
                  account_id: 'host-account',
                  display_name: 'Host Name',
                };
              else if (hasOrgProfile && filters.org_id === 'session-org')
                data = {
                  id: 'member-profile',
                  kind: guardian ? 'guardian' : 'adult',
                  display_name: 'Member Name',
                  first_name: null,
                  last_name: null,
                };
            }
            if (table === 'accounts')
              data = filters.id
                ? { auth_user_id: 'host-auth' }
                : { id: authUserId === 'host-auth' ? 'host-account' : 'member-account' };
            return { data, error: null };
          },
        };
        return query;
      },
    } as never);
    getJoinAccess.mockResolvedValue({
      token: 'synthetic-join-token',
      expiresAt: null,
      metadata: { sessionName: 'test-class' },
    });
    jest.mocked(getLiveSessionProvider).mockReturnValue({ getJoinAccess } as never);
    jest.mocked(verifyZoomPasscode).mockReturnValue(true);
  });
  it.each([
    [
      'provider-issued topic',
      { sessionName: 'signed-class-topic' },
      { sessionName: 'stored-class-topic', passcode: 'demo' },
      'signed-class-topic',
    ],
    ['legacy provider ID', undefined, { passcode: 'demo' }, 'test-class'],
  ])(
    'uses the same %s for host and participant joins on either client',
    async (_case, issuedMetadata, storedMetadata, expectedName) => {
      sessionMetadata = storedMetadata as Record<string, unknown>;
      getJoinAccess.mockResolvedValue({
        token: 'synthetic-token',
        metadata: issuedMetadata,
      });
      authUserId = 'host-auth';
      const service = new LiveSessionsService();
      const host = await service.getPublicLiveSessionInfo(
        'session-identity',
        'synthetic-host-auth',
      );
      authUserId = null;
      const participant = await service.guestJoinLiveSession(
        'session-identity',
        'cross-client-participant',
        { displayName: 'Student', passcode: 'demo' },
      );
      expect(host).toMatchObject({
        isHost: true,
        hostJoin: { sessionName: expectedName },
      });
      expect(participant.sessionName).toBe(expectedName);
      expect(getJoinAccess).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sessionId: 'session-identity',
          providerSessionId: 'test-class',
          isHost: true,
        }),
      );
      expect(getJoinAccess).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sessionId: 'session-identity',
          providerSessionId: 'test-class',
          isHost: false,
        }),
      );
    },
  );
  it('does not replace a blank provider-issued topic with another room name', async () => {
    getJoinAccess.mockResolvedValue({
      token: 'synthetic-token',
      metadata: { sessionName: ' ' },
    });
    authUserId = 'host-auth';
    const service = new LiveSessionsService();
    await expect(
      service.getPublicLiveSessionInfo('session-identity', 'synthetic-host-auth'),
    ).rejects.toThrow('Unable to resolve the classroom session');
    authUserId = null;
    await expect(
      service.guestJoinLiveSession('session-identity', 'blank-topic', {
        displayName: 'Student',
        passcode: 'demo',
      }),
    ).rejects.toThrow('Unable to resolve the classroom session');
  });
  it('rejects credentials with no Zoom topic instead of using the database ID', async () => {
    providerSessionId = null;
    sessionMetadata = { passcode: 'demo' };
    getJoinAccess.mockResolvedValue({ token: 'synthetic-token' });
    authUserId = 'host-auth';
    const service = new LiveSessionsService();
    await expect(
      service.getPublicLiveSessionInfo('session-identity', 'synthetic-host-auth'),
    ).rejects.toThrow('Unable to resolve the classroom session');
    authUserId = null;
    await expect(
      service.guestJoinLiveSession('session-identity', 'missing-topic', {
        displayName: 'Student',
        passcode: 'demo',
      }),
    ).rejects.toThrow('Unable to resolve the classroom session');
  });
  it('resolves a normalized short code to a canonical guest session without credentials', async () => {
    const info = await new LiveSessionsService().getPublicLiveSessionInfo(
      'A3F8-B2D4-C9E1',
      null,
    );
    expect(info).toMatchObject({
      exists: true,
      isActive: true,
      isHost: false,
      sessionId: 'session-identity',
      shareCode: 'a3f8b2d4c9e1',
    });
    expect(lookupFilters).toContainEqual({
      table: 'channel_live_sessions',
      filters: { share_code: 'a3f8b2d4c9e1' },
    });
    expect(evaluateApiBooleanFlag).not.toHaveBeenCalled();
    expect(info).not.toHaveProperty('hostJoin');
    expect(getJoinAccess).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown or deleted meeting code', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    };
    jest
      .mocked(createSupabaseServiceClient)
      .mockReturnValue({ from: () => query } as never);
    expect(
      await new LiveSessionsService().getPublicLiveSessionInfo('a3f8-b2d4-c9e1', null),
    ).toEqual({ exists: false });
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(getJoinAccess).not.toHaveBeenCalled();
  });

  it('shows the ended state for a short code without issuing credentials', async () => {
    status = 'ended';
    expect(
      await new LiveSessionsService().getPublicLiveSessionInfo('a3f8-b2d4-c9e1', null),
    ).toMatchObject({ exists: true, isActive: false });
    expect(getJoinAccess).not.toHaveBeenCalled();
  });

  it('returns the signed-in member name without issuing host credentials', async () => {
    const result = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'synthetic-auth',
    );
    expect(result).toMatchObject({
      isHost: false,
      participant: { displayName: 'Member Name' },
    });
    expect(result).not.toHaveProperty('hostJoin');
    expect(getJoinAccess).not.toHaveBeenCalled();
    expect(issueAnnotationAccess).not.toHaveBeenCalled();
    expect(lookupFilters).toContainEqual({
      table: 'profiles',
      filters: { account_id: 'member-account', org_id: 'session-org' },
    });
  });
  it('uses a verified participant profile and ignores a spoofed submitted name', async () => {
    const result = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'test-ip-member',
      { displayName: 'Spoofed Host', passcode: 'demo' },
      'synthetic-auth',
    );
    expect(result.displayName).toBe('Member Name');
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'member-profile',
        displayName: 'Member Name',
        isHost: false,
      }),
    );
  });
  it('allows verified Classroom members when shared invites are disabled', async () => {
    invitesEnabled = false;
    const result = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'member-invite-disabled',
      { displayName: 'Ignored', passcode: 'demo' },
      'synthetic-auth',
    );
    expect(result.settings?.invite.enabled).toBe(false);
    expect(lookupFilters).toContainEqual({
      table: 'channel_members',
      filters: {
        org_id: 'session-org',
        channel_id: 'class',
        profile_id: 'member-profile',
      },
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ isHost: false }),
    );
  });
  it('blocks signed-in non-members when shared invites are disabled', async () => {
    invitesEnabled = false;
    isClassMember = false;
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'nonmember-invite-disabled',
        { displayName: 'Member', passcode: 'demo' },
        'synthetic-auth',
      ),
    ).rejects.toThrow('Shared invitations are disabled');
    expect(getJoinAccess).not.toHaveBeenCalled();
    expect(issueAnnotationAccess).not.toHaveBeenCalled();
  });
  it('blocks users without an org profile when shared invites are disabled', async () => {
    invitesEnabled = false;
    hasOrgProfile = false;
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'visitor-invite-disabled',
        { displayName: 'Member', passcode: 'demo' },
        'synthetic-auth',
      ),
    ).rejects.toThrow('Shared invitations are disabled');
    expect(getJoinAccess).not.toHaveBeenCalled();
    expect(issueAnnotationAccess).not.toHaveBeenCalled();
  });
  it('does not require a passcode for a verified signed-in participant', async () => {
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    const result = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'signed-in-no-passcode',
      { displayName: 'Member', passcode: '' },
      'synthetic-auth',
    );
    expect(result).toMatchObject({ meetingPasscode: 'demo' });
    expect(verifyZoomPasscode).not.toHaveBeenCalled();
  });
  it('lets org staff join a classroom without membership or a passcode when invites are disabled', async () => {
    invitesEnabled = false;
    isClassMember = false;
    isOrgStaff = true;
    jest.mocked(hasOrgStaffRole).mockResolvedValue(true);
    const result = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'staff-no-passcode',
      { displayName: 'Staff', passcode: '' },
      'synthetic-auth',
    );
    expect(result).toHaveProperty('token');
    expect(hasOrgStaffRole).toHaveBeenCalledWith(expect.anything(), 'session-org', [
      'member-profile',
    ]);
    expect(verifyZoomPasscode).not.toHaveBeenCalled();
  });
  it('still rejects anonymous visitors with an empty passcode', async () => {
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'anonymous-empty',
        { displayName: 'Guest', passcode: '' },
        null,
      ),
    ).rejects.toThrow('Incorrect passcode');
  });
  it('does not assign a profile from another org to signed-in visitors', async () => {
    hasOrgProfile = false;
    const result = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'test-ip-visitor',
      { displayName: 'Spoofed', passcode: 'demo' },
      'synthetic-auth',
    );
    expect(result.displayName).toBe('Signed-in Visitor');
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: expect.stringMatching(/^guest:/),
        isHost: false,
      }),
    );
  });
  it('treats an invalid bearer token as anonymous', async () => {
    authUserId = null;
    const service = new LiveSessionsService();
    const info = await service.getPublicLiveSessionInfo('session-identity', 'invalid');
    expect(info).not.toHaveProperty('participant');
    const joined = await service.guestJoinLiveSession(
      'session-identity',
      'test-ip-invalid',
      { displayName: 'Guest', passcode: 'demo' },
      'invalid',
    );
    expect(joined.displayName).toBe('Guest');
    expect(joined.annotationToken).toBe('synthetic-annotation-token');
    expect(issueAnnotationAccess).toHaveBeenCalledWith('session-identity', 'Guest');
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: expect.stringMatching(/^guest:/),
        isHost: false,
      }),
    );
  });
  it('admits an invitation as a guest without turning it into sender host credentials', async () => {
    authUserId = null;
    jest
      .mocked(resolveMeetingLink)
      .mockResolvedValue({ purpose: 'invite', auth_user_id: null } as never);
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'invite-guest',
      { displayName: 'Guest', passcode: '', linkToken: 'a'.repeat(32) },
    );
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        isHost: false,
        profileId: expect.stringMatching(/^guest:/),
      }),
    );
    expect(verifyZoomPasscode).not.toHaveBeenCalled();
  });
  it('does not let invitation links bypass disabled guest invitations', async () => {
    authUserId = null;
    invitesEnabled = false;
    jest
      .mocked(resolveMeetingLink)
      .mockResolvedValue({ purpose: 'invite', auth_user_id: null } as never);
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'invite-disabled',
        { displayName: 'Guest', passcode: '', linkToken: 'a'.repeat(32) },
      ),
    ).rejects.toThrow('Shared invitations are disabled');
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
  it('preserves the mobile host identity without a browser login', async () => {
    authUserId = 'host-auth';
    jest
      .mocked(resolveMeetingLink)
      .mockResolvedValue({ purpose: 'access', auth_user_id: 'host-auth' } as never);
    const info = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      null,
      'a'.repeat(32),
    );
    expect(info).toMatchObject({
      isHost: true,
      hostJoin: {
        displayName: 'Host Name',
        annotationToken: 'synthetic-annotation-token',
      },
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ isHost: true, profileId: 'host-profile' }),
    );
  });
  it('preserves host-role credentials for the verified starter', async () => {
    authUserId = 'host-auth';
    const result = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'synthetic-host-auth',
    );
    expect(result).toMatchObject({
      isHost: true,
      hostJoin: { displayName: 'Host Name', expiresAt: null },
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'host-profile', isHost: true }),
    );
  });
  it('issues host credentials for the verified starter through the join endpoint', async () => {
    authUserId = 'host-auth';
    await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'starter-join',
      { displayName: 'Ignored', passcode: '' },
      'synthetic-host-auth',
    );
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'host-profile', isHost: true }),
    );
  });
  it('issues staff host credentials without classroom membership', async () => {
    isClassMember = false;
    isOrgStaff = true;
    jest.mocked(hasOrgStaffRole).mockResolvedValue(true);
    const result = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'synthetic-staff-auth',
    );
    expect(result).toMatchObject({ isHost: true });
    expect(getJoinAccess).toHaveBeenCalledWith(expect.objectContaining({ isHost: true }));
  });
  it('gives a signed-in classroom teacher host credentials even when someone else started it', async () => {
    isTeacher = true;
    const result = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'synthetic-auth',
    );
    expect(result).toMatchObject({
      isHost: true,
      hostJoin: { displayName: 'Member Name' },
    });
    expect(issueWhiteboardAccess).toHaveBeenCalledWith(
      'session-identity',
      'teacher',
      'Member Name',
    );
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'member-profile', isHost: true }),
    );
  });
  it('gives a verified teacher host credentials through guest-join without requiring a passcode', async () => {
    isTeacher = true;
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'teacher-join',
      { displayName: 'Ignored', passcode: 'wrong' },
      'synthetic-auth',
    );
    expect(issueWhiteboardAccess).toHaveBeenCalledWith(
      'session-identity',
      'teacher',
      'Member Name',
    );
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'member-profile', isHost: true }),
    );
  });
  it('does not make an unrelated teacher a host', async () => {
    isTeacher = true;
    isClassMember = false;
    const result = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'synthetic-auth',
    );
    expect(result).toMatchObject({ isHost: false });
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
  it('fails closed if host permission verification fails', async () => {
    const service = createSupabaseServiceClient() as unknown as { rpc: jest.Mock };
    service.rpc.mockResolvedValue({
      data: true,
      error: { message: 'Database unavailable' },
    });
    await expect(
      new LiveSessionsService().getPublicLiveSessionInfo(
        'session-identity',
        'synthetic-auth',
      ),
    ).rejects.toThrow('Unable to verify meeting host permissions');
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
  it('does not resolve identities or issue credentials for ended sessions', async () => {
    status = 'ended';
    expect(
      await new LiveSessionsService().getPublicLiveSessionInfo(
        'session-identity',
        'synthetic-auth',
      ),
    ).toMatchObject({ isActive: false });
    expect(getJoinAccess).not.toHaveBeenCalled();
    expect(issueAnnotationAccess).not.toHaveBeenCalled();
    expect(createSupabaseSessionClient).not.toHaveBeenCalled();
  });
  it('offers only enrolled linked children and automatically names a single student', async () => {
    guardian = true;
    enrolledStudents = ['child-two'];
    const info = await new LiveSessionsService().getPublicLiveSessionInfo(
      'session-identity',
      'auth',
    );
    expect(info).toMatchObject({
      isHost: false,
      participant: {
        displayName: 'Ben',
        students: [{ profileId: 'child-two', displayName: 'Ben' }],
      },
    });
    expect(lookupFilters).toContainEqual({
      table: 'family_links',
      filters: { org_id: 'session-org', guardian_account_id: 'member-account' },
    });
    expect(lookupFilters).toContainEqual({
      table: 'profiles',
      filters: {
        org_id: 'session-org',
        kind: 'child',
        account_id: ['child-account-one', 'child-account-two'],
        'accounts.status': 'active',
      },
    });
    const joined = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'parent-single',
      { displayName: 'Parent', passcode: 'demo' },
      'auth',
    );
    expect(selections).toContain(
      'id, display_name, first_name, last_name, accounts!profiles_account_id_fkey!inner(id)',
    );
    expect(joined).toMatchObject({
      displayName: 'Ben',
      studentProfileId: 'child-two',
      annotationToken: 'synthetic-annotation-token',
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'child-two',
        displayName: 'Ben',
        isHost: false,
      }),
    );
    expect(issueWhiteboardAccess).toHaveBeenCalledWith(
      'session-identity',
      'student',
      'Ben',
    );
    expect(issueAnnotationAccess).toHaveBeenCalledWith('session-identity', 'Ben');
  });
  it('requires a choice for siblings and uses the verified name even if parent has host permission', async () => {
    guardian = true;
    isTeacher = true;
    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession(
        'session-identity',
        'parent-choice',
        { displayName: 'Parent', passcode: 'demo' },
        'auth',
      ),
    ).rejects.toThrow('Choose');
    await service.guestJoinLiveSession(
      'session-identity',
      'parent-chosen',
      { displayName: 'Forged', passcode: 'demo', studentProfileId: 'child-one' },
      'auth',
    );
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'child-one',
        displayName: 'Alice',
        isHost: false,
      }),
    );
  });
  it('rejects children outside the eligible enrollment and parents with no enrolled children', async () => {
    guardian = true;
    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession(
        'session-identity',
        'parent-invalid',
        { displayName: 'Parent', passcode: 'demo', studentProfileId: 'unrelated-child' },
        'auth',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    enrolledStudents = [];
    await expect(
      service.guestJoinLiveSession(
        'session-identity',
        'parent-none',
        { displayName: 'Parent', passcode: 'demo' },
        'auth',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
  it('authorizes siblings sharing one connection with a combined name and a distinct shared identity', async () => {
    guardian = true;
    const service = new LiveSessionsService();
    const input = {
      displayName: 'Forged',
      passcode: 'demo',
      studentProfileIds: ['child-two', 'child-one'],
    };
    const joined = await service.guestJoinLiveSession(
      'session-identity',
      'parent-both',
      input,
      'auth',
    );
    expect(joined).toMatchObject({
      displayName: 'Alice & Ben',
      studentProfileIds: ['child-one', 'child-two'],
    });
    expect(joined.studentProfileId).toBeUndefined();
    expect(getJoinAccess).toHaveBeenLastCalledWith(
      expect.objectContaining({
        displayName: 'Alice & Ben',
        profileId: expect.stringMatching(/^shared:/),
        isHost: false,
      }),
    );
    const key =
      getJoinAccess.mock.calls[getJoinAccess.mock.calls.length - 1][0].profileId;
    await service.guestJoinLiveSession(
      'session-identity',
      'parent-both-again',
      {
        ...input,
        studentProfileIds: ['child-one', 'child-two'],
        displayNameOverride: 'Study buddies',
      },
      'auth',
    );
    expect(getJoinAccess).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profileId: key,
        displayName: 'Study buddies',
        isHost: false,
      }),
    );
    expect(issueWhiteboardAccess).toHaveBeenLastCalledWith(
      'session-identity',
      'student',
      'Study buddies',
    );
  });
  it.each([
    { ids: ['child-one', 'unrelated-child'] },
    { ids: ['child-one', 'child-one'] },
    { ids: [] },
  ])('rejects invalid shared selections $ids', async ({ ids }) => {
    guardian = true;
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'parent-invalid-group',
        { displayName: 'Parent', passcode: 'demo', studentProfileIds: ids },
        'auth',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
  it('rejects group selection by a non-parent', async () => {
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'spoof-group',
        {
          displayName: 'Parent',
          passcode: 'demo',
          studentProfileIds: ['child-one', 'child-two'],
        },
        'auth',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('binds admission to the full canonical sibling set rather than only one student', async () => {
    guardian = true;
    restricted = true;
    const service = new LiveSessionsService();
    const input = {
      displayName: 'Parent',
      passcode: 'demo',
      admissionToken: 'a'.repeat(32),
      studentProfileIds: ['child-two', 'child-one'],
    };
    await service.guestJoinLiveSession(
      'session-identity',
      'group-admission',
      input,
      'auth',
    );
    const first = jest.mocked(requireMeetingAdmission).mock.calls[0][2];
    expect(JSON.parse(first)[1]).toEqual(['child-one', 'child-two']);
    await service.guestJoinLiveSession(
      'session-identity',
      'group-admission-repeat',
      { ...input, studentProfileIds: ['child-one', 'child-two'] },
      'auth',
    );
    expect(jest.mocked(requireMeetingAdmission).mock.calls[1][2]).toBe(first);
    await service.guestJoinLiveSession(
      'session-identity',
      'single-admission',
      { ...input, studentProfileIds: ['child-one'] },
      'auth',
    );
    expect(jest.mocked(requireMeetingAdmission).mock.calls[2][2]).not.toBe(first);
  });
  it('checks selected student membership when shared invitations are disabled', async () => {
    guardian = true;
    invitesEnabled = false;
    await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'parent-private',
      { displayName: 'Parent', passcode: 'demo', studentProfileId: 'child-one' },
      'auth',
    );
    expect(lookupFilters).toContainEqual({
      table: 'channel_members',
      filters: { org_id: 'session-org', channel_id: 'class', profile_id: 'child-one' },
    });
  });
  it.each(['member-auth', null])(
    'rejects represented-student requests from non-parent identities (%s)',
    async (user) => {
      authUserId = user;
      await expect(
        new LiveSessionsService().guestJoinLiveSession(
          'session-identity',
          'spoof-child',
          { displayName: 'Parent', passcode: 'demo', studentProfileId: 'child-one' },
          'auth',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(getJoinAccess).not.toHaveBeenCalled();
    },
  );
  it('applies an explicit preview label without changing the selected student or permissions', async () => {
    guardian = true;
    const joined = await new LiveSessionsService().guestJoinLiveSession(
      'session-identity',
      'parent-renamed',
      {
        displayName: 'Alice',
        passcode: 'demo',
        studentProfileId: 'child-one',
        displayNameOverride: 'Alice S.',
      },
      'auth',
    );
    expect(joined).toMatchObject({
      displayName: 'Alice S.',
      studentProfileId: 'child-one',
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'child-one',
        displayName: 'Alice S.',
        isHost: false,
      }),
    );
    expect(issueWhiteboardAccess).toHaveBeenCalledWith(
      'session-identity',
      'student',
      'Alice S.',
    );
    expect(issueAnnotationAccess).toHaveBeenCalledWith('session-identity', 'Alice S.');
  });
  it('still rejects an empty passcode for a renamed anonymous guest', async () => {
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'renamed-no-passcode',
        { displayName: 'Member', displayNameOverride: 'Member S.', passcode: '' },
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getJoinAccess).not.toHaveBeenCalled();
  });
});
