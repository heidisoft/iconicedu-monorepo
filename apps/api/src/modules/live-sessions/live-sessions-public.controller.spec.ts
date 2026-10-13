import { HttpException } from '@nestjs/common';
import { LiveSessionsPublicController } from './live-sessions-public.controller';
import type { LiveSessionsService } from './live-sessions.service';
describe('meeting asynchronous admission transport', () => {
  it('returns a 202 pending response without sending the capability through exception telemetry', async () => {
    const admission = { token: 'a'.repeat(32), status: 'waiting' };
    const service = {
      guestJoinLiveSession: jest
        .fn()
        .mockRejectedValue(new HttpException({ message: 'Waiting', admission }, 409)),
    } as unknown as LiveSessionsService;
    const controller = new LiveSessionsPublicController(service);
    const status = jest.fn();
    expect(
      await controller.guestJoin(
        { headers: {}, ip: 'synthetic' },
        'session',
        { displayName: 'Guest', passcode: 'demo' },
        { status },
      ),
    ).toEqual({ admission });
    expect(status).toHaveBeenCalledWith(202);
  });
  it('does not turn failed authorization into successful admission', async () => {
    const service = {
      guestJoinLiveSession: jest
        .fn()
        .mockRejectedValue(new HttpException('Forbidden', 403)),
    } as unknown as LiveSessionsService;
    const controller = new LiveSessionsPublicController(service);
    const status = jest.fn();
    await expect(
      controller.guestJoin(
        { headers: {} },
        'session',
        { displayName: 'Guest', passcode: 'demo' },
        { status },
      ),
    ).rejects.toThrow('Forbidden');
    expect(status).not.toHaveBeenCalled();
  });
});
