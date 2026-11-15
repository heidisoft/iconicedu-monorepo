import { BadRequestException } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';

describe('SchedulesController.getLearningSpaceEditContext', () => {
  function makeController() {
    const getLearningSpaceEditContext = jest.fn(async () => ({
      participantProfileIds: [],
    }));
    const controller = new SchedulesController({ getLearningSpaceEditContext } as never);
    return { controller, getLearningSpaceEditContext };
  }

  const req = { headers: { authorization: 'Bearer token-1' } } as never;

  it.each([
    ['orgId', undefined, 'space-1', 'channel-1'],
    ['learningSpaceId', 'org-1', undefined, 'channel-1'],
    ['channelId', 'org-1', 'space-1', undefined],
    ['orgId', '', 'space-1', 'channel-1'],
  ])(
    'rejects a request missing %s without calling the service',
    (param, orgId, learningSpaceId, channelId) => {
      const { controller, getLearningSpaceEditContext } = makeController();
      expect(() =>
        controller.getLearningSpaceEditContext(
          req,
          orgId as never,
          learningSpaceId as never,
          channelId as never,
        ),
      ).toThrow(new BadRequestException(`${param} is required`));
      expect(getLearningSpaceEditContext).not.toHaveBeenCalled();
    },
  );

  it('rejects array-valued query params (e.g. ?orgId=a&orgId=b)', () => {
    const { controller, getLearningSpaceEditContext } = makeController();
    expect(() =>
      controller.getLearningSpaceEditContext(
        req,
        ['org-1', 'org-2'] as never,
        'space-1',
        'channel-1',
      ),
    ).toThrow(BadRequestException);
    expect(getLearningSpaceEditContext).not.toHaveBeenCalled();
  });

  it('forwards the bearer token and scoped ids to the service', async () => {
    const { controller, getLearningSpaceEditContext } = makeController();
    await controller.getLearningSpaceEditContext(req, 'org-1', 'space-1', 'channel-1');
    expect(getLearningSpaceEditContext).toHaveBeenCalledWith('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    });
  });
});
