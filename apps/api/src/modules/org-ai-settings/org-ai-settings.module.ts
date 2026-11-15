import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { OrgAiSettingsController } from '@iconicedu/api/modules/org-ai-settings/org-ai-settings.controller';
import { OrgAiSettingsService } from '@iconicedu/api/lib/ai/org-ai-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [OrgAiSettingsController],
  providers: [OrgAiSettingsService],
  exports: [OrgAiSettingsService],
})
export class OrgAiSettingsModule {}
