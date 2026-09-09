import { EventsController } from './events.controller';

describe('push dispatch endpoint', () => {
  const original = process.env.INTERNAL_EVENTS_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_EVENTS_TOKEN;
    else process.env.INTERNAL_EVENTS_TOKEN = original;
  });
  it('requires the internal token and always selects the push worker', async () => {
    process.env.INTERNAL_EVENTS_TOKEN = 'test-internal-token';
    const dispatchDueJobs = jest.fn(async () => ({ claimed: 0 }));
    const controller = new EventsController({ dispatchDueJobs } as never);
    await expect(controller.dispatchPushNotifications(undefined, {})).rejects.toThrow(
      'Unauthorized',
    );
    expect(dispatchDueJobs).not.toHaveBeenCalled();
    await controller.dispatchPushNotifications('Bearer test-internal-token', {
      limit: 5,
      pushOnly: false,
    });
    expect(dispatchDueJobs).toHaveBeenCalledWith(
      expect.objectContaining({ pushOnly: true, limit: 5 }),
    );
  });
});

describe('schedule-reconciliation dispatch endpoint', () => {
  const original = process.env.INTERNAL_EVENTS_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_EVENTS_TOKEN;
    else process.env.INTERNAL_EVENTS_TOKEN = original;
  });
  it('requires the internal token and always selects the reconciliation worker', async () => {
    process.env.INTERNAL_EVENTS_TOKEN = 'test-internal-token';
    const dispatchDueJobs = jest.fn(async () => ({ claimed: 0 }));
    const controller = new EventsController({ dispatchDueJobs } as never);
    await expect(
      controller.dispatchScheduleReconciliation(undefined, {}),
    ).rejects.toThrow('Unauthorized');
    expect(dispatchDueJobs).not.toHaveBeenCalled();
    await controller.dispatchScheduleReconciliation('Bearer test-internal-token', {
      limit: 12,
      reconcileOnly: false,
    });
    expect(dispatchDueJobs).toHaveBeenCalledWith(
      expect.objectContaining({ reconcileOnly: true, limit: 12 }),
    );
  });
});
