import { FamilyChildInvitesController } from './family-child-invites.controller';
import { FamilyChildInvitesService } from './family-child-invites.service';
import { ProfileSettingsService } from './profile-settings.service';
import { TimezoneLocationService } from './timezone-location.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { NotificationPreferencesModule } from '@iconicedu/api/modules/notification-preferences/notification-preferences.module';
import { ProfilesController } from '@iconicedu/api/modules/profiles/profiles.controller';
import { ProfilesService } from '@iconicedu/api/modules/profiles/profiles.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule],
  controllers: [ProfilesController, FamilyChildInvitesController],
  providers: [
    FamilyChildInvitesService,
    ProfileSettingsService,
    ProfilesService,
    TimezoneLocationService,
  ],
})
export class ProfilesModule {}
