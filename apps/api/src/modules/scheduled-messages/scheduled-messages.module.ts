import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { ScheduledMessagesController } from '@iconicedu/api/modules/scheduled-messages/scheduled-messages.controller';
import { ScheduledMessagesService } from '@iconicedu/api/modules/scheduled-messages/scheduled-messages.service';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
