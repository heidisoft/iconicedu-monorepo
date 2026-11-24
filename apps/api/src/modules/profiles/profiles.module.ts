import { TimezoneLocationService } from './timezone-location.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { NotificationPreferencesModule } from '@iconicedu/api/modules/notification-preferences/notification-preferences.module';
import { ProfilesController } from '@iconicedu/api/modules/profiles/profiles.controller';
import { ProfilesService } from '@iconicedu/api/modules/profiles/profiles.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, TimezoneLocationService],
})
export class ProfilesModule {}
