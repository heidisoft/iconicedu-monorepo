import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentItemsModule } from '@iconicedu/api/modules/assessment-items/assessment-items.module';
import { AssessmentTestsModule } from '@iconicedu/api/modules/assessment-tests/assessment-tests.module';
import { AssessmentSessionsService } from './assessment-sessions.service';
import { AssessmentSessionsController } from './assessment-sessions.controller';

@Module({
  imports: [AuthModule, AssessmentItemsModule, AssessmentTestsModule],
  providers: [AssessmentSessionsService],
  controllers: [AssessmentSessionsController],
  exports: [AssessmentSessionsService],
})
export class AssessmentSessionsModule {}
