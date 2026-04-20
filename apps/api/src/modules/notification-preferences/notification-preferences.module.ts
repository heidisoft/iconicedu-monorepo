import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { NotificationPreferencesController } from '@iconicedu/api/modules/notification-preferences/notification-preferences.controller';
import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
