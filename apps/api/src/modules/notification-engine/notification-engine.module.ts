import { Module } from '@nestjs/common';

import { NotificationEngineController } from '@iconicedu/api/modules/notification-engine/notification-engine.controller';
import { NotificationEngineService } from '@iconicedu/api/modules/notification-engine/notification-engine.service';

@Module({
  controllers: [NotificationEngineController],
  providers: [NotificationEngineService],
})
export class NotificationEngineModule {}
