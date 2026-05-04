import { Module } from '@nestjs/common';

import { AnalyticsModule } from '@iconicedu/api/analytics/analytics.module';
import { ActivityWorkerController } from '@iconicedu/api/modules/activity-worker/activity-worker.controller';
import { ActivityWorkerService } from '@iconicedu/api/modules/activity-worker/activity-worker.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [ActivityWorkerController],
  providers: [ActivityWorkerService],
  exports: [ActivityWorkerService],
})
export class ActivityWorkerModule {}
