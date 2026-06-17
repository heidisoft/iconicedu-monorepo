import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentResultsService } from './assessment-results.service';
import { AssessmentResultsController } from './assessment-results.controller';

@Module({
  imports: [AuthModule],
  providers: [AssessmentResultsService],
  controllers: [AssessmentResultsController],
  exports: [AssessmentResultsService],
})
export class AssessmentResultsModule {}
