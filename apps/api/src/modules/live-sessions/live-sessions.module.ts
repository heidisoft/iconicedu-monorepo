import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { LiveSessionRoomsController } from '@iconicedu/api/modules/live-sessions/live-session-rooms.controller';
import { LiveSessionsController } from '@iconicedu/api/modules/live-sessions/live-sessions.controller';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';

@Module({
  imports: [AuthModule],
  controllers: [LiveSessionsController, LiveSessionRoomsController],
  providers: [LiveSessionsService],
  exports: [LiveSessionsService],
})
export class LiveSessionsModule {}
