import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dispatchDueNotificationJobsMock, createSupabaseServiceClientMock } = vi.hoisted(
  () => ({
    dispatchDueNotificationJobsMock: vi.fn(),
    createSupabaseServiceClientMock: vi.fn(() => ({ __brand: 'service-client' })),
  }),
);

vi.mock('@iconicedu/web/lib/notifications/dispatch-jobs', () => ({
  dispatchDueNotificationJobs: (...args: unknown[]) =>
    dispatchDueNotificationJobsMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

import { POST } from '@iconicedu/web/app/api/internal/notifications/dispatch/route';

describe('POST /api/internal/notifications/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when token is configured and authorization is invalid', async () => {
    process.env.INTERNAL_NOTIFICATIONS_TOKEN = 'secret-token';

    const response = await POST(
      new Request('http://localhost/api/internal/notifications/dispatch', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(dispatchDueNotificationJobsMock).not.toHaveBeenCalled();
  });

  it('dispatches notification jobs with parsed payload', async () => {
    process.env.INTERNAL_NOTIFICATIONS_TOKEN = 'secret-token';
    dispatchDueNotificationJobsMock.mockResolvedValue({
      claimed: 3,
      succeeded: 2,
      suppressed: 1,
      failed: 0,
      deadLettered: 0,
    });

    const response = await POST(
      new Request('http://localhost/api/internal/notifications/dispatch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ limit: 25, leaseSeconds: 150, leaseOwner: 'cron-worker' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(dispatchDueNotificationJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseOwner: 'cron-worker',
        limit: 25,
        leaseSeconds: 150,
      }),
    );
  });
});
