import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ChannelsService } from '@iconicedu/api/modules/channels/channels.service';
import { ChannelsController } from '@iconicedu/api/modules/channels/channels.controller';

@Module({
  imports: [AuthModule],
  providers: [ChannelsService],
  controllers: [ChannelsController],
})
export class ChannelsModule {}
