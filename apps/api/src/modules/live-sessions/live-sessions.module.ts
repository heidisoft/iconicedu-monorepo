import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';
import { LiveSessionsController } from '@iconicedu/api/modules/live-sessions/live-sessions.controller';

@Module({
  imports: [AuthModule],
  providers: [LiveSessionsService],
  controllers: [LiveSessionsController],
})
export class LiveSessionsModule {}
