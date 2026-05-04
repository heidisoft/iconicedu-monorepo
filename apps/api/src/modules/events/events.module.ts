import { Module } from '@nestjs/common';

import { ActivityWorkerModule } from '@iconicedu/api/modules/activity-worker/activity-worker.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { EventPipelineService } from '@iconicedu/api/modules/events/event-pipeline.service';
import { EventsController } from '@iconicedu/api/modules/events/events.controller';
import { NotificationService } from '@iconicedu/api/modules/events/notification.service';

@Module({
  imports: [ActivityWorkerModule, RemindersModule],
  controllers: [EventsController],
  providers: [EventPipelineService, NotificationService],
})
export class EventsModule {}
