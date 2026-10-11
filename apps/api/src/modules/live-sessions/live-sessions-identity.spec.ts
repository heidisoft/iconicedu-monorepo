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
  getLiveSessionProvider: jest.fn(),
  verifyZoomPasscode: jest.fn(),
}));

describe('public live session identity and authorization', () => {
  const getJoinAccess = jest.fn();
  let authUserId: string | null;
  let hasOrgProfile: boolean;
  let status: string;
  let invitesEnabled: boolean;
  let isClassMember: boolean;
  let isTeacher: boolean;
  let guardian: boolean;
  let enrolledStudents: string[];
  let lookupFilters: Array<{ table: string; filters: Record<string, unknown> }>;
  beforeEach(() => {
    jest.clearAllMocks();
    authUserId = 'member-auth';
    hasOrgProfile = true;
    status = 'live';
    invitesEnabled = true;
    isClassMember = true;
    isTeacher = false;
    guardian = false;
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
          args.p_user === 'host-auth' || (hasOrgProfile && isTeacher && isClassMember),
        error: null,
      })),
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const query = {
          select: jest.fn().mockReturnThis(),
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
                org_id: 'session-org',
                channel_id: 'class',
                provider: 'zoom',
                status,
                started_by_profile_id: 'host-profile',
                provider_session_id: 'test-class',
                provider_metadata: { sessionName: 'test-class', passcode: 'demo' },
                ...(!invitesEnabled
                  ? {
                      app_metadata: {
                        meetingSettings: {
                          ...DEFAULT_LIVE_SESSION_SETTINGS,
                          invite: { enabled: false },
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
  it('still requires a correct passcode for signed-in non-hosts', async () => {
    jest.mocked(verifyZoomPasscode).mockReturnValue(false);
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'session-identity',
        'test-ip-passcode',
        { displayName: 'Member', passcode: 'wrong' },
        'synthetic-auth',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getJoinAccess).not.toHaveBeenCalled();
    expect(issueAnnotationAccess).not.toHaveBeenCalled();
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
});
