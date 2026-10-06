import { ScreenAnnotationsService } from '../screen-annotations/screen-annotations.service';
import { ScreenAnnotationsController } from '../screen-annotations/screen-annotations.controller';
import { ClassroomMeetingSettingsService } from './classroom-meeting-settings.service';
import { ClassroomMeetingSettingsController } from './classroom-meeting-settings.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';
import { LiveSessionsController } from '@iconicedu/api/modules/live-sessions/live-sessions.controller';
import { LiveSessionsPublicController } from '@iconicedu/api/modules/live-sessions/live-sessions-public.controller';

@Module({
  imports: [AuthModule],
  providers: [
    ScreenAnnotationsService,
    LiveSessionsService,
    ClassroomMeetingSettingsService,
  ],
  controllers: [
    ScreenAnnotationsController,
    LiveSessionsController,
    LiveSessionsPublicController,
    ClassroomMeetingSettingsController,
  ],
})
export class LiveSessionsModule {}
