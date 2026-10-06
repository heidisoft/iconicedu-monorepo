import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import {
  createOrJoinLiveSession,
  getLiveSessionProvider,
  verifyZoomPasscode,
} from '@iconicedu/live-sessions-core';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';

jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  evaluateApiBooleanFlag: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/actor/resolve-actor-profile', () => ({
  loadAndAuthorizeProfile: jest.fn(),
}));

jest.mock('@iconicedu/live-sessions-core', () => ({
  createOrJoinLiveSession: jest.fn(),
  getLiveSessionProvider: jest.fn(),
  verifyZoomPasscode: jest.fn(),
}));

describe('LiveSessionsService.joinLiveSession', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
  const loadAndAuthorizeProfileMock = jest.mocked(loadAndAuthorizeProfile);
  const createOrJoinLiveSessionMock = jest.mocked(createOrJoinLiveSession);

  const input = { orgId: 'org-1', profileId: 'profile-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({
          data: { slug: 'iconic-academy' },
          error: null,
        })),
      })),
    } as never);
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
  });

  it.each([false, true])(
    'uses the saved manager flag to snapshot policy only when enabled=%s',
    async (enabled) => {
      jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(enabled);
      loadAndAuthorizeProfileMock.mockResolvedValue({
        profile: { id: 'participant', account_id: 'account', org_id: 'org-1' } as never,
        account: { id: 'account', org_id: 'org-1' },
      });
      const policy = { ...DEFAULT_LIVE_SESSION_SETTINGS, invite: { enabled: false } };
      createSupabaseServiceClientMock.mockReturnValue({
        from: (table: string) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: async () => ({
            data:
              table === 'orgs'
                ? { slug: 'academy' }
                : {
                    live_session_config: {
                      settings: policy,
                      settingsProfileId: 'manager',
                    },
                  },
            error: null,
          }),
        }),
      } as never);
      createOrJoinLiveSessionMock.mockResolvedValue({
        sessionId: 'session',
        joinPath: '/live/session',
        status: 'live',
        created: true,
        provider: 'zoom',
      });
      await new LiveSessionsService().joinLiveSession('token', 'channel', input);
      expect(evaluateApiBooleanFlag).toHaveBeenCalledWith(
        expect.objectContaining({ distinctId: 'manager' }),
      );
      const call = createOrJoinLiveSessionMock.mock.calls[0][0];
      if (enabled) expect(call.meetingSettings).toEqual(policy);
      else expect(call).not.toHaveProperty('meetingSettings');
    },
  );

  it('joins a live session once the acting profile is authorized', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockResolvedValue({
      sessionId: 'session-1',
      joinPath: '/iconic-academy/live-sessions/session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    const service = new LiveSessionsService();
    const result = await service.joinLiveSession('token-1', 'channel-1', input);

    expect(result).toEqual({
      sessionId: 'session-1',
      joinPath: '/iconic-academy/live-sessions/session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });
    expect(createOrJoinLiveSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-1',
        orgSlug: 'iconic-academy',
        actor: expect.objectContaining({
          authUserId: 'auth-user-1',
          account: { id: 'account-1', org_id: 'org-1' },
        }),
      }),
    );
  });

  it('rejects when the caller is not authorized to act as the profile', async () => {
    loadAndAuthorizeProfileMock.mockRejectedValue(new ForbiddenException('Unauthorized'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createOrJoinLiveSessionMock).not.toHaveBeenCalled();
  });

  it('maps a missing channel to a 400', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockRejectedValue(new Error('Channel not found'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps an unauthorized join-time error to a 403', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockRejectedValue(new Error('Unauthorized'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('LiveSessionsService.guestJoinLiveSession', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const getLiveSessionProviderMock = jest.mocked(getLiveSessionProvider);
  const verifyZoomPasscodeMock = jest.mocked(verifyZoomPasscode);

  const guestInput = { displayName: 'Taylor Reed', passcode: 'abc123xyz9' };

  function mockSessionRow(row: Record<string, unknown> | null) {
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: row, error: null })),
      })),
    } as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mints a participant token when the passcode matches', async () => {
    mockSessionRow({
      id: 'session-1',
      provider: 'zoom',
      status: 'live',
      provider_session_id: 'ls-session',
      provider_metadata: { sessionName: 'ls-session', passcode: 'abc123xyz9' },
    });
    verifyZoomPasscodeMock.mockReturnValue(true);
    const getJoinAccess = jest.fn(async () => ({
      token: 'guest-token',
      expiresAt: null,
    }));
    getLiveSessionProviderMock.mockReturnValue({
      key: 'zoom',
      createSession: jest.fn(),
      getJoinAccess,
      normalizeWebhook: jest.fn(),
    });

    const service = new LiveSessionsService();
    const result = await service.guestJoinLiveSession(
      'session-1',
      '127.0.0.1',
      guestInput,
    );

    expect(result).toEqual({
      token: 'guest-token',
      sessionName: 'ls-session',
      displayName: 'Taylor Reed',
      expiresAt: null,
      settings: DEFAULT_LIVE_SESSION_SETTINGS,
    });
    expect(getJoinAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        displayName: 'Taylor Reed',
        isHost: false,
      }),
    );
    expect(String(getJoinAccess.mock.calls[0][0].profileId)).toMatch(/^guest:/);
  });

  it('rejects anonymous shared-link joins when invitations are disabled', async () => {
    mockSessionRow({
      id: 'invite-disabled-session',
      org_id: 'org',
      channel_id: 'channel',
      provider: 'zoom',
      status: 'live',
      provider_metadata: { passcode: 'abc123xyz9' },
      app_metadata: {
        meetingSettings: { ...DEFAULT_LIVE_SESSION_SETTINGS, invite: { enabled: false } },
      },
    });
    verifyZoomPasscodeMock.mockReturnValue(true);
    await expect(
      new LiveSessionsService().guestJoinLiveSession(
        'invite-disabled-session',
        'test-invite-ip',
        guestInput,
      ),
    ).rejects.toThrow('Shared invitations are disabled');
    expect(getLiveSessionProviderMock).not.toHaveBeenCalled();
  });

  it('rejects an incorrect passcode without minting a token', async () => {
    mockSessionRow({
      id: 'session-1',
      provider: 'zoom',
      status: 'live',
      provider_session_id: 'ls-session',
      provider_metadata: { sessionName: 'ls-session', passcode: 'abc123xyz9' },
    });
    verifyZoomPasscodeMock.mockReturnValue(false);

    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession('session-1', '127.0.0.1', guestInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getLiveSessionProviderMock).not.toHaveBeenCalled();
  });

  it('404s when the session does not exist', async () => {
    mockSessionRow(null);

    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession('missing-session', '127.0.0.1', guestInput),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a non-zoom session', async () => {
    mockSessionRow({
      id: 'session-1',
      provider: 'daily',
      status: 'live',
      provider_session_id: 'room-1',
      provider_metadata: {},
    });

    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession('session-1', '127.0.0.1', guestInput),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a session that has already ended', async () => {
    mockSessionRow({
      id: 'session-1',
      provider: 'zoom',
      status: 'ended',
      provider_session_id: 'ls-session',
      provider_metadata: { passcode: 'abc123xyz9' },
    });

    const service = new LiveSessionsService();
    await expect(
      service.guestJoinLiveSession('session-1', '127.0.0.1', guestInput),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate-limits repeated attempts from the same session and IP', async () => {
    mockSessionRow({
      id: 'session-1',
      provider: 'zoom',
      status: 'live',
      provider_session_id: 'ls-session',
      provider_metadata: { sessionName: 'ls-session', passcode: 'abc123xyz9' },
    });
    verifyZoomPasscodeMock.mockReturnValue(false);

    const service = new LiveSessionsService();
    const attempt = () =>
      service.guestJoinLiveSession('session-1', '10.0.0.1', {
        ...guestInput,
        passcode: 'wrong',
      });

    for (let i = 0; i < 5; i += 1) {
      await expect(attempt()).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(attempt()).rejects.toThrow('Too many join attempts');
  });
});

describe('LiveSessionsService.submitLiveSessionFeedback', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

  const feedbackInput = { rating: 5, displayName: 'Taylor Reed' };

  function mockSessionAndInsert(
    sessionRow: Record<string, unknown> | null,
    insertError: { message: string } | null = null,
  ) {
    const insert = jest.fn(async () => ({ error: insertError }));
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'channel_live_session_feedback') {
          return { insert };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: sessionRow, error: null })),
        };
      }),
    } as never);
    return insert;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records feedback without a profile_id when no access token is given', async () => {
    const insert = mockSessionAndInsert({
      id: 'session-1',
      org_id: 'org-1',
      channel_id: 'channel-1',
    });

    const service = new LiveSessionsService();
    const result = await service.submitLiveSessionFeedback(
      'session-1',
      '127.0.0.1',
      null,
      feedbackInput,
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        live_session_id: 'session-1',
        channel_id: 'channel-1',
        profile_id: null,
        display_name: 'Taylor Reed',
        rating: 5,
      }),
    );
  });

  it('404s when the session does not exist', async () => {
    mockSessionAndInsert(null);

    const service = new LiveSessionsService();
    await expect(
      service.submitLiveSessionFeedback(
        'missing-session',
        '127.0.0.1',
        null,
        feedbackInput,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rate-limits repeated submissions from the same session and IP', async () => {
    mockSessionAndInsert({ id: 'session-1', org_id: 'org-1', channel_id: 'channel-1' });

    const service = new LiveSessionsService();
    const attempt = () =>
      service.submitLiveSessionFeedback('session-1', '10.0.0.1', null, feedbackInput);

    for (let i = 0; i < 3; i += 1) {
      await expect(attempt()).resolves.toEqual({ success: true });
    }
    await expect(attempt()).rejects.toThrow('Too many feedback submissions');
  });
});

describe('LiveSessionsService.reportLiveSessionQualityEvent', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

  const qualityInput = {
    displayName: 'Taylor Reed',
    metric: 'network_quality' as const,
    level: 'bad',
    occurredAt: '2026-01-01T00:00:00.000Z',
  };

  function mockSessionAndInsert(
    sessionRow: Record<string, unknown> | null,
    insertError: { message: string } | null = null,
  ) {
    const insert = jest.fn(async () => ({ error: insertError }));
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'channel_live_session_quality_events') {
          return { insert };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: sessionRow, error: null })),
        };
      }),
    } as never);
    return insert;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a quality event without a profile_id when no access token is given', async () => {
    const insert = mockSessionAndInsert({
      id: 'session-1',
      org_id: 'org-1',
      channel_id: 'channel-1',
    });

    const service = new LiveSessionsService();
    const result = await service.reportLiveSessionQualityEvent(
      'session-1',
      '127.0.0.1',
      null,
      qualityInput,
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        live_session_id: 'session-1',
        channel_id: 'channel-1',
        profile_id: null,
        display_name: 'Taylor Reed',
        metric: 'network_quality',
        level: 'bad',
        occurred_at: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('404s when the session does not exist', async () => {
    mockSessionAndInsert(null);

    const service = new LiveSessionsService();
    await expect(
      service.reportLiveSessionQualityEvent(
        'missing-session',
        '127.0.0.1',
        null,
        qualityInput,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rate-limits repeated reports from the same session and IP', async () => {
    mockSessionAndInsert({ id: 'session-1', org_id: 'org-1', channel_id: 'channel-1' });

    const service = new LiveSessionsService();
    const attempt = () =>
      service.reportLiveSessionQualityEvent('session-1', '10.0.0.2', null, qualityInput);

    for (let i = 0; i < 30; i += 1) {
      await expect(attempt()).resolves.toEqual({ success: true });
    }
    await expect(attempt()).rejects.toThrow('Too many quality reports');
  });
});

describe('LiveSessionsService.logLiveSessionAuditEvent', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

  const auditInput = {
    action: 'mute_participant' as const,
    targetDisplayName: 'Riley Student',
    occurredAt: '2026-01-01T00:00:00.000Z',
  };

  function mockSessionAndInsert(
    sessionRow: Record<string, unknown> | null,
    insertError: { message: string } | null = null,
  ) {
    const insert = jest.fn(async () => ({ error: insertError }));
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'channel_live_session_audit_events') {
          return { insert };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: sessionRow, error: null })),
        };
      }),
    } as never);
    return insert;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records an audit event without an actor_profile_id when no access token is given', async () => {
    const insert = mockSessionAndInsert({
      id: 'session-1',
      org_id: 'org-1',
      channel_id: 'channel-1',
    });

    const service = new LiveSessionsService();
    const result = await service.logLiveSessionAuditEvent(
      'session-1',
      '127.0.0.1',
      null,
      auditInput,
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        live_session_id: 'session-1',
        channel_id: 'channel-1',
        actor_profile_id: null,
        action: 'mute_participant',
        metadata: { targetDisplayName: 'Riley Student' },
        occurred_at: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('404s when the session does not exist', async () => {
    mockSessionAndInsert(null);

    const service = new LiveSessionsService();
    await expect(
      service.logLiveSessionAuditEvent('missing-session', '127.0.0.1', null, auditInput),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rate-limits repeated audit logs from the same session and IP', async () => {
    mockSessionAndInsert({ id: 'session-1', org_id: 'org-1', channel_id: 'channel-1' });

    const service = new LiveSessionsService();
    const attempt = () =>
      service.logLiveSessionAuditEvent('session-1', '10.0.0.3', null, auditInput);

    for (let i = 0; i < 60; i += 1) {
      await expect(attempt()).resolves.toEqual({ success: true });
    }
    await expect(attempt()).rejects.toThrow('Too many audit events');
  });
});
