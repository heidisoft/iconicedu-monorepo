import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { MessagePinsController } from '@iconicedu/api/modules/message-pins/message-pins.controller';
import { MessagePinsService } from '@iconicedu/api/modules/message-pins/message-pins.service';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [MessagePinsController],
  providers: [MessagePinsService],
})
export class MessagePinsModule {}
