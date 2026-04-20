import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';

import {
  parseDispatchActivityJobsDto,
  type DispatchActivityJobsDto,
} from '@iconicedu/api/modules/activity-worker/dto/dispatch-activity-jobs.dto';
import { ActivityWorkerService } from '@iconicedu/api/modules/activity-worker/activity-worker.service';

function resolveExpectedToken() {
  return (
    process.env.INTERNAL_ACTIVITY_WORKER_TOKEN_API?.trim() ||
    process.env.INTERNAL_ACTIVITY_WORKER_TOKEN?.trim() ||
    ''
  );
}

@Controller()
export class ActivityWorkerController {
  constructor(private readonly activityWorkerService: ActivityWorkerService) {}

  @Post('internal/activity-worker/dispatch')
  async dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const expectedToken = resolveExpectedToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }

    const dto: DispatchActivityJobsDto = parseDispatchActivityJobsDto(body);
    return this.activityWorkerService.dispatchDuePendingJobs({
      leaseOwner: dto.leaseOwner ?? 'internal-activity-worker-dispatch-api',
      limit: dto.limit,
      leaseSeconds: dto.leaseSeconds,
    });
  }
}
