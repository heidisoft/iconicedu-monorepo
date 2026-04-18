import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { PresenceController } from '@iconicedu/api/modules/presence/presence.controller';
import { PresenceService } from '@iconicedu/api/modules/presence/presence.service';

@Module({
  imports: [AuthModule],
  controllers: [PresenceController],
  providers: [PresenceService],
})
export class PresenceModule {}
