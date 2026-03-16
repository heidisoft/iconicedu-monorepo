import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/channel-schedules/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildClassSchedulesByOrg = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({
    data: { id: 'account-1', org_id: 'org-1' },
  })),
}));

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: (...args: unknown[]) => buildClassSchedulesByOrg(...args),
}));

describe('GET /api/messages/channel-schedules', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await GET(new Request(`${APP_URL}/api/messages/channel-schedules`));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'channelId is required' });
  });

  it('returns schedules scoped to the channel id', async () => {
    buildClassSchedulesByOrg.mockResolvedValueOnce([
      {
        ids: { id: 'schedule-1', orgId: 'org-1' },
        title: 'Math Session',
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
        },
      },
      {
        ids: { id: 'schedule-2', orgId: 'org-1' },
        title: 'Science Session',
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-2',
        },
      },
    ]);

    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-schedules?channelId=channel-1`),
    );

    expect(buildClassSchedulesByOrg).toHaveBeenCalledWith({}, 'org-1');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      schedules: [
        {
          ids: { id: 'schedule-1', orgId: 'org-1' },
          title: 'Math Session',
          source: {
            kind: 'class_session',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
          },
        },
      ],
    });
  });
});
