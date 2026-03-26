import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesController } from '@iconicedu/api/modules/messages/messages.controller';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
