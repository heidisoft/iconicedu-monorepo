import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ChannelsService } from '@iconicedu/api/modules/channels/channels.service';
import { ChannelsController } from '@iconicedu/api/modules/channels/channels.controller';
import { ThreadsModule } from '@iconicedu/api/modules/threads/threads.module';

@Module({
  imports: [AuthModule, ThreadsModule],
  providers: [ChannelsService],
  controllers: [ChannelsController],
})
export class ChannelsModule {}
