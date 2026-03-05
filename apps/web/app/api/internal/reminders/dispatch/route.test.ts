import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dispatchDueReminderJobsMock, createSupabaseServiceClientMock } = vi.hoisted(
  () => ({
    dispatchDueReminderJobsMock: vi.fn(),
    createSupabaseServiceClientMock: vi.fn(() => ({ __brand: 'service-client' })),
  }),
);

vi.mock('@iconicedu/web/lib/automation/reminder-jobs', () => ({
  dispatchDueReminderJobs: (...args: unknown[]) => dispatchDueReminderJobsMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

import { POST } from '@iconicedu/web/app/api/internal/reminders/dispatch/route';

describe('POST /api/internal/reminders/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when token is configured and authorization is invalid', async () => {
    process.env.INTERNAL_REMINDERS_TOKEN = 'secret-token';

    const response = await POST(
      new Request('http://localhost/api/internal/reminders/dispatch', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(dispatchDueReminderJobsMock).not.toHaveBeenCalled();
  });

  it('dispatches reminder jobs with parsed payload', async () => {
    process.env.INTERNAL_REMINDERS_TOKEN = 'secret-token';
    dispatchDueReminderJobsMock.mockResolvedValue({
      claimed: 3,
      succeeded: 3,
      failed: 0,
      deadLettered: 0,
    });

    const response = await POST(
      new Request('http://localhost/api/internal/reminders/dispatch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ limit: 25, leaseSeconds: 150, leaseOwner: 'cron-worker' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(dispatchDueReminderJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseOwner: 'cron-worker',
        limit: 25,
        leaseSeconds: 150,
      }),
    );
  });
});
