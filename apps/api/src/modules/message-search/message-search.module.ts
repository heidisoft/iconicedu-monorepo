import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { MessageSearchController } from '@iconicedu/api/modules/message-search/message-search.controller';
import { MessageSearchService } from '@iconicedu/api/modules/message-search/message-search.service';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [MessageSearchController],
  providers: [MessageSearchService],
})
export class MessageSearchModule {}
