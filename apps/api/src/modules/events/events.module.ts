import { Module } from '@nestjs/common';

import { EventsController } from '@iconicedu/api/modules/events/events.controller';
import { EventsService } from '@iconicedu/api/modules/events/events.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
