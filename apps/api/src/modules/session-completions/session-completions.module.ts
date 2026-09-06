import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { SessionCompletionsController } from '@iconicedu/api/modules/session-completions/session-completions.controller';
import { SessionCompletionsService } from '@iconicedu/api/modules/session-completions/session-completions.service';

@Module({
  imports: [AuthModule],
  controllers: [SessionCompletionsController],
  providers: [SessionCompletionsService],
  exports: [SessionCompletionsService],
})
export class SessionCompletionsModule {}
