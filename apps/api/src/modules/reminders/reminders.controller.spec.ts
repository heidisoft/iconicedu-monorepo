import { RemindersController } from './reminders.controller';

describe('completion dispatch endpoint', () => {
  const original = process.env.INTERNAL_REMINDERS_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_REMINDERS_TOKEN;
    else process.env.INTERNAL_REMINDERS_TOKEN = original;
  });
  it('requires the internal token and selects only completion jobs', async () => {
    process.env.INTERNAL_REMINDERS_TOKEN = 'test-internal-token';
    const dispatchDueCompletionCheckJobs = jest.fn(async () => ({ claimed: 0 }));
    const controller = new RemindersController({
      dispatchDueCompletionCheckJobs,
    } as never);
    await expect(controller.dispatchCompletionChecks(undefined, {})).rejects.toThrow(
      'Unauthorized',
    );
    expect(dispatchDueCompletionCheckJobs).not.toHaveBeenCalled();
    await controller.dispatchCompletionChecks('Bearer test-internal-token', { limit: 7 });
    expect(dispatchDueCompletionCheckJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 7 }),
    );
  });
});
