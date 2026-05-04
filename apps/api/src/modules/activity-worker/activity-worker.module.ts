import { Module } from '@nestjs/common';

import { ActivityWorkerService } from '@iconicedu/api/modules/activity-worker/activity-worker.service';

@Module({
  providers: [ActivityWorkerService],
  exports: [ActivityWorkerService],
})
export class ActivityWorkerModule {}
