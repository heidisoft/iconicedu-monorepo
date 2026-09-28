import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { OrgAiSettingsModule } from '@iconicedu/api/modules/org-ai-settings/org-ai-settings.module';
import { AiAssistController } from '@iconicedu/api/modules/ai-assist/ai-assist.controller';
import { AiAssistService } from '@iconicedu/api/modules/ai-assist/ai-assist.service';

@Module({
  imports: [AuthModule, MessagesModule, OrgAiSettingsModule],
  controllers: [AiAssistController],
  providers: [AiAssistService],
})
export class AiAssistModule {}
