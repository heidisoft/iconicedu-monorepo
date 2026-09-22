import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { AiAssistController } from '@iconicedu/api/modules/ai-assist/ai-assist.controller';
import { AiAssistService } from '@iconicedu/api/modules/ai-assist/ai-assist.service';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [AiAssistController],
  providers: [AiAssistService],
})
export class AiAssistModule {}
