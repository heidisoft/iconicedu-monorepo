import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LiveSessionQualityService } from './live-session-quality.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

function setup(role: string, sessionExists = true) {
  const events = [
    {
      id: 'event',
      display_name: 'Student',
      metric: 'network_quality',
      level: 'poor',
      occurred_at: '2026-10-12T12:00:00Z',
    },
  ];
  const filters = jest.fn().mockReturnThis();
  const qualityRead = jest.fn();
  jest.mocked(createSupabaseSessionClient).mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'user' } }, error: null })),
    },
  } as never);
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    from: jest.fn((table) => {
      if (table === 'channel_live_session_quality_events') qualityRead();
      return {
        select: jest.fn().mockReturnThis(),
        eq: filters,
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({
          error: null,
          data:
            table === 'accounts'
              ? { id: 'account' }
              : sessionExists
                ? { id: 'session' }
                : null,
        })),
        returns: jest.fn(async () => ({
          error: null,
          data: table === 'user_roles' ? [{ role_key: role }] : events,
        })),
      };
    }),
  } as never);
  return { events, filters, qualityRead };
}
beforeEach(() => jest.clearAllMocks());
it.each(['staff', 'admin', 'owner'])(
  'allows %s to read quality events with tenant filters',
  async (role) => {
    const { events, filters } = setup(role);
    expect(await new LiveSessionQualityService().list('token', 'org', 'session')).toEqual(
      events,
    );
    expect(filters).toHaveBeenCalledWith('org_id', 'org');
    expect(filters).toHaveBeenCalledWith('live_session_id', 'session');
  },
);
it('rejects regular members before reading events', async () => {
  const { qualityRead } = setup('student');
  await expect(
    new LiveSessionQualityService().list('token', 'org', 'session'),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(qualityRead).not.toHaveBeenCalled();
});
it('rejects a session outside the authorized organization', async () => {
  const { qualityRead } = setup('staff', false);
  await expect(
    new LiveSessionQualityService().list('token', 'org', 'other-session'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(qualityRead).not.toHaveBeenCalled();
});
