import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import { ClassroomMeetingSettingsService } from './classroom-meeting-settings.service';

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

describe('Classroom meeting settings authorization and storage', () => {
  const service = new ClassroomMeetingSettingsService();
  const update = jest.fn();
  const filter = jest.fn();
  let role = 'admin';
  let accountId = 'account';
  let channel: { id: string; live_session_config: Record<string, unknown> } | null;
  beforeEach(() => {
    jest.clearAllMocks();
    role = 'admin';
    accountId = 'account';
    channel = {
      id: 'channel',
      live_session_config: { enabled: true, provider: 'zoom', mode: 'video' },
    };
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
    jest.mocked(loadAndAuthorizeProfile).mockResolvedValue({
      profile: { id: 'profile', account_id: 'account' } as never,
      account: { id: 'account', org_id: 'org' },
    });
    jest.mocked(createSupabaseSessionClient).mockReturnValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    } as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      from: (table: string) => {
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: filter.mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          update: update.mockReturnThis(),
          maybeSingle: async () => ({
            data: table === 'accounts' ? { id: accountId } : channel,
            error: null,
          }),
          then: (resolve: (value: unknown) => void) =>
            resolve({ data: [{ role_key: role }], error: null }),
        };
        return query;
      },
    } as never);
  });
  const input = {
    orgId: 'org',
    profileId: 'profile',
    classroomId: 'class',
    settings: { ...DEFAULT_LIVE_SESSION_SETTINGS, invite: { enabled: false } },
  };
  it('stores options through the API while preserving provider fields and tenant scope', async () => {
    await service.save('token', input);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        live_session_config: expect.objectContaining({
          provider: 'zoom',
          mode: 'video',
          settings: input.settings,
          settingsProfileId: 'profile',
        }),
      }),
    );
    expect(filter).toHaveBeenCalledWith('org_id', 'org');
    expect(filter).toHaveBeenCalledWith('primary_entity_id', 'class');
    expect(filter).toHaveBeenCalledWith('primary_entity_kind', 'learning_space');
  });
  it('rejects flag-off writes', async () => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    await expect(service.save('token', input)).rejects.toThrow('not enabled');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects non-manager roles', async () => {
    role = 'student';
    await expect(service.save('token', input)).rejects.toThrow('manager access');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects delegated profiles belonging to a different account', async () => {
    accountId = 'other-account';
    await expect(service.save('token', input)).rejects.toThrow('manager access');
  });
  it('does not permit saving against a Classroom outside the actor organization', async () => {
    channel = null;
    await expect(service.save('token', input)).rejects.toThrow('not found');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects options for unsupported providers', async () => {
    channel!.live_session_config.provider = 'daily';
    await expect(service.save('token', input)).rejects.toThrow('enabled Zoom');
    expect(update).not.toHaveBeenCalled();
  });
});
